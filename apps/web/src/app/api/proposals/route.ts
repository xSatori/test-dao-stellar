import { NextResponse } from 'next/server';
import { Client as GovernorClient } from '@stellar-dao/governor-bindings';
import { getDaoNetworkConfig, getDefaultDaoNetwork } from '@/lib/dao-config';
import { getMercuryActivityFeed, getMercuryProposalDetail, getMercuryProposalVotes } from '@/lib/mercury';
import { proposalIdToBuffer } from '@/lib/proposal-id';
import { parseProposalMetadata, type ProposalMetadata } from '@/lib/proposal-metadata';
import { proposalStateLabel, type ProposalState as ProposalStateValue } from '@/lib/proposal-state';

type ProposalListItem = {
  proposalId: string;
  metadata: ProposalMetadata;
  state: ProposalStateValue | null;
  stateLabel: string;
  ledger: number;
  timestamp: number;
  txHash: string;
  contractId: string;
  voteTotals: {
    forVotes: string;
    againstVotes: string;
    abstainVotes: string;
  } | null;
};

type ProposalGroup = {
  proposalId: string;
  latestLedger: number;
  latestTimestamp: number;
};

async function fetchProposalState(client: InstanceType<typeof GovernorClient>, proposalId: string) {
  const proposalBuffer = proposalIdToBuffer(proposalId);
  const stateTx = await client.proposal_state({ proposal_id: proposalBuffer });
  return stateTx.result;
}

function summarizeVotes(votes: Awaited<ReturnType<typeof getMercuryProposalVotes>>['items']) {
  const totals = votes.reduce(
    (result, vote) => {
      try {
        const weight = BigInt(vote.weight);
        if (vote.support === 1) result.forVotes += weight;
        else if (vote.support === 0) result.againstVotes += weight;
        else if (vote.support === 2) result.abstainVotes += weight;
      } catch {
        // Ignore malformed indexed weights rather than misreporting a total.
      }
      return result;
    },
    { forVotes: 0n, againstVotes: 0n, abstainVotes: 0n }
  );

  return {
    forVotes: totals.forVotes.toString(),
    againstVotes: totals.againstVotes.toString(),
    abstainVotes: totals.abstainVotes.toString()
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? '24'), 100));
  const config = getDaoNetworkConfig(getDefaultDaoNetwork());

  if (!config.governorContractId) {
    return NextResponse.json({ items: [], generatedAt: new Date().toISOString(), message: 'Missing governor contract id' }, { status: 400 });
  }

  try {
    const feed = await getMercuryActivityFeed(limit * 6);
    const groups = new Map<string, ProposalGroup>();

    for (const item of feed.items) {
      if (item.programKey !== 'governor' || !item.proposalId) {
        continue;
      }

      const current = groups.get(item.proposalId);
      if (!current) {
        groups.set(item.proposalId, {
          proposalId: item.proposalId,
          latestLedger: item.ledger,
          latestTimestamp: item.timestamp
        });
        continue;
      }

      current.latestLedger = Math.max(current.latestLedger, item.ledger);
      current.latestTimestamp = Math.max(current.latestTimestamp, item.timestamp);
    }

    const client = new GovernorClient({
      contractId: config.governorContractId,
      rpcUrl: config.rpcUrl,
      networkPassphrase: config.passphrase,
      publicKey: config.adminAddress
    });

    const items = await Promise.all(
      [...groups.values()]
        .sort((a, b) => b.latestTimestamp - a.latestTimestamp || b.latestLedger - a.latestLedger)
        .slice(0, limit)
        .map(async (group): Promise<ProposalListItem> => {
          const [detail, voteResponse] = await Promise.all([
            getMercuryProposalDetail(group.proposalId).catch(() => null),
            getMercuryProposalVotes(group.proposalId).catch(() => null)
          ]);
          const metadata = parseProposalMetadata(detail?.description ?? '');
          const voteTotals = voteResponse && !voteResponse.message ? summarizeVotes(voteResponse.items) : null;

          try {
            const state = await fetchProposalState(client, group.proposalId);
            return {
              proposalId: group.proposalId,
              metadata,
              state,
              stateLabel: proposalStateLabel(state),
              ledger: detail?.ledger ?? group.latestLedger,
              timestamp: detail?.timestamp ?? group.latestTimestamp,
              txHash: detail?.txHash ?? '',
              contractId: detail?.contractId ?? '',
              voteTotals
            };
          } catch {
            return {
              proposalId: group.proposalId,
              metadata,
              state: null,
              stateLabel: 'Unknown',
              ledger: detail?.ledger ?? group.latestLedger,
              timestamp: detail?.timestamp ?? group.latestTimestamp,
              txHash: detail?.txHash ?? '',
              contractId: detail?.contractId ?? '',
              voteTotals
            };
          }
        })
    );

    return NextResponse.json({ items, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { items: [], generatedAt: new Date().toISOString(), message: error instanceof Error ? error.message : 'Proposal list unavailable' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
