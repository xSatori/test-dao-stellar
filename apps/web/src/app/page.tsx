'use client';

import { useState } from 'react';
import { Activity, ChevronDown, MoreHorizontal } from 'lucide-react';
import { DaoShell } from '@/components/dao-shell';
import { PageSection } from '@/components/page-section';
import { Badge, Button, Callout, Card, Heading, ShortId, Text } from '@/components/ui';
import { getDaoNetworkConfig, getDefaultDaoNetwork } from '@/lib/dao-config';
import { useMercuryActivityFeed, useMercuryProgramStatuses } from '@/lib/mercury-queries';
import { useTokenInventory } from '@/lib/token-queries';
import { TokenCard } from '@/components/token/token-card';
import { Stack } from 'styled-system/jsx';

function formatTimestamp(timestamp: number) {
  if (!timestamp) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp * 1000));
  } catch {
    return String(timestamp);
  }
}

const ACTIVITY_PAGE_SIZE = 12;
const TOKEN_PAGE_SIZE = 8;

export default function Page() {
  const network = getDefaultDaoNetwork();
  const config = getDaoNetworkConfig(network);
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE_SIZE);
  const [tokenLimit, setTokenLimit] = useState(TOKEN_PAGE_SIZE);
  const { data: mercuryStatuses, error: mercuryStatusError, isLoading: mercuryStatusLoading, mutate: refreshStatuses } = useMercuryProgramStatuses();
  const { data: mercuryFeed, error: mercuryFeedError, isLoading: mercuryFeedLoading, mutate: refreshFeed } = useMercuryActivityFeed(activityLimit);
  const { data: tokens, error: tokenError, isLoading: tokenLoading, mutate: refreshTokens } = useTokenInventory();
  const tokenItems = tokens?.items.slice(0, tokenLimit) ?? [];
  const canLoadMoreTokens = Boolean(tokens && tokens.items.length > tokenLimit);
  const activityItems = mercuryFeed?.items.slice(0, activityLimit) ?? [];
  const proposalActivity = activityItems.filter((item) => Boolean(item.proposalId));
  const canLoadMoreActivity = Boolean(mercuryFeed && mercuryFeed.items.length >= activityLimit);
  const mercuryPrograms = mercuryStatuses?.items ?? [];
  const indexerIsHealthy = mercuryPrograms.length > 0 && mercuryPrograms.every((program) => program.running);
  const indexerHealthLabel = mercuryStatusLoading
    ? 'Checking indexer health'
    : mercuryStatusError
      ? 'Indexer health unavailable'
      : indexerIsHealthy
        ? 'Indexer healthy'
        : 'Indexer needs attention';

  return (
    <DaoShell>
      <PageSection
        title="Dashboard"
        description="Your DAO activity at a glance."
      >
        <div className="dashboard-controls">
          <details className="dashboard-menu">
            <summary className="dashboard-menu__trigger">
              Contracts
              <ChevronDown aria-hidden="true" size={14} />
            </summary>
            <div className="dashboard-menu__panel dashboard-contract-menu">
              <Text className="label">Contracts</Text>
              <div className="dashboard-contract-menu__items">
                {config.tokenContractId ? <ShortId label="Token" value={config.tokenContractId} /> : <Text>Token: Missing</Text>}
                {config.governorContractId ? <ShortId label="Governor" value={config.governorContractId} /> : <Text>Governor: Missing</Text>}
                {config.treasuryContractId ? <ShortId label="Treasury" value={config.treasuryContractId} /> : <Text>Treasury: Missing</Text>}
                <ShortId label="Admin" value={config.adminAddress} />
              </div>
            </div>
          </details>
          <details className="dashboard-menu dashboard-menu--options">
            <summary className="dashboard-menu__trigger dashboard-menu__trigger--icon" aria-label="Dashboard options" title="Dashboard options">
              <MoreHorizontal aria-hidden="true" size={18} />
            </summary>
            <div className="dashboard-menu__panel dashboard-options-menu">
              <Text className="label">Dashboard options</Text>
              <Text className="lede" style={{ margin: 0, fontSize: '0.84rem' }}>No additional dashboard options are available.</Text>
            </div>
          </details>
        </div>

        <Card p="5">
          <Stack gap="3">
            <div>
              <Heading style={{ fontSize: '1.35rem', margin: 0 }}>Proposal activity</Heading>
            </div>
            {mercuryFeedError ? <Callout variant="error" title="Proposal activity unavailable" description={mercuryFeedError.message} /> : null}
            {mercuryFeedLoading && !mercuryFeed ? <Callout variant="info" title="Loading proposal activity…" /> : null}
            {!mercuryFeedLoading && !proposalActivity.length ? (
              <div className="empty-state" role="status"><Text className="lede" style={{ margin: '0 auto' }}>Proposal activity will appear here once proposals are indexed.</Text></div>
            ) : proposalActivity.length ? (
              <div className="dashboard-activity-list">
                {proposalActivity.map((item, index) => (
                  <div className="dashboard-activity-row" key={item.id} data-first={index === 0 ? 'true' : undefined}>
                    <Stack gap="1">
                      <Text style={{ margin: 0, fontWeight: 700 }}>{item.title}</Text>
                      <Text className="lede" style={{ margin: 0, fontSize: '0.9rem' }}>{item.summary}</Text>
                      <Text className="lede" style={{ margin: 0, fontSize: '0.8rem' }}>{formatTimestamp(item.timestamp)} | Ledger {item.ledger}</Text>
                    </Stack>
                  </div>
                ))}
              </div>
            ) : null}
          </Stack>
        </Card>

        <div className="dashboard-secondary-grid">
          <Card className="dashboard-secondary-card" p="5">
            <div className="dashboard-secondary-card__content">
              <Heading style={{ fontSize: '1.35rem', margin: 0 }}>Auction activity</Heading>
              <div className="dashboard-secondary-card__scroll">
                <div className="empty-state" role="status">
                  <Text className="lede" style={{ margin: '0 auto' }}>Auction activity is not currently indexed for this dashboard.</Text>
                </div>
              </div>
            </div>
          </Card>

          <Card className="dashboard-secondary-card" p="5">
            <div className="dashboard-secondary-card__content">
            <div className="section-toolbar">
              <div>
                <Heading style={{ fontSize: '1.35rem', margin: 0 }}>Current live supply</Heading>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge>{tokenLoading ? 'Syncing' : `${tokens?.totalSupply ?? 0} live`}</Badge>
                <Button type="button" variant="outline" size="sm" onClick={() => void refreshTokens()} disabled={tokenLoading}>
                  {tokenLoading ? 'Refreshing...' : 'Refresh tokens'}
                </Button>
              </div>
            </div>

              <div className="dashboard-secondary-card__scroll">
                {tokenError ? <Callout variant="error" title="Token inventory unavailable" description={tokenError.message} /> : null}
                {!tokenLoading && !tokens?.items.length ? (
                  <div className="empty-state" role="status"><Text className="lede" style={{ margin: '0 auto' }}>No tokens have been indexed yet. Refresh after the first mint is confirmed.</Text></div>
                ) : (
                  <>
                    <div className="token-inventory-grid">
                      {tokenItems.map((token) => (
                        <TokenCard key={token.tokenId} tokenId={token.tokenId} owner={token.owner} />
                      ))}
                    </div>
                    {canLoadMoreTokens ? (
                      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
                        <Button type="button" variant="outline" size="sm" onClick={() => setTokenLimit((current) => current + TOKEN_PAGE_SIZE)} disabled={tokenLoading}>
                          {tokenLoading ? 'Loading...' : 'Show more tokens'}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          <style jsx>{`
            .token-inventory-grid {
              display: grid;
              gap: 18px;
              grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            }

            @media (min-width: 768px) {
              .token-inventory-grid {
                gap: 20px;
                grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
              }
            }
          `}</style>
          </Card>
        </div>

        <Card p="5">
          <Stack gap="3">
            <div className="section-toolbar">
              <div>
                <Heading style={{ fontSize: '1.35rem', margin: 0 }}>Activity feed</Heading>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <details className="dashboard-health-menu">
                  <summary className="dashboard-health-trigger" aria-label={`${indexerHealthLabel}. View indexer health`} title={indexerHealthLabel}>
                    <Activity aria-hidden="true" size={16} />
                    <span className={`dashboard-health-dot${indexerIsHealthy ? ' dashboard-health-dot--healthy' : ''}`} aria-hidden="true" />
                  </summary>
                  <div className="dashboard-health-panel">
                    <div className="dashboard-health-panel__heading">
                      <Text className="label">Indexer health</Text>
                      <Button type="button" variant="outline" size="sm" onClick={() => void refreshStatuses()} disabled={mercuryStatusLoading}>
                        {mercuryStatusLoading ? 'Refreshing...' : 'Refresh'}
                      </Button>
                    </div>
                    <Text className="lede" style={{ margin: 0, fontSize: '0.84rem' }}>{indexerHealthLabel}</Text>
                    {mercuryStatusError ? <Text className="lede" style={{ margin: 0, fontSize: '0.8rem' }}>{mercuryStatusError.message}</Text> : null}
                    {mercuryPrograms.map((program) => (
                      <div className="dashboard-health-program" key={program.key}>
                        <Text style={{ margin: 0, fontWeight: 700 }}>{program.label}</Text>
                        <Text className="lede" style={{ margin: 0, fontSize: '0.78rem' }}>
                          {program.running ? 'Running' : 'Stopped'} | {program.totalExecutions} executions | {program.totalErrors} errors
                        </Text>
                      </div>
                    ))}
                  </div>
                </details>
                <Badge>{mercuryFeedLoading ? 'Syncing' : 'Live'}</Badge>
                <Button type="button" variant="outline" size="sm" onClick={() => void refreshFeed()} disabled={mercuryFeedLoading}>
                  {mercuryFeedLoading ? 'Refreshing...' : 'Refresh feed'}
                </Button>
              </div>
            </div>
            {mercuryFeedError ? <Callout variant="error" title="Activity feed unavailable" description={mercuryFeedError.message} /> : null}
            {!activityItems.length ? (
              <div className="empty-state" role="status"><Text className="lede" style={{ margin: '0 auto' }}>No indexed activity yet. Governance and token events will appear here.</Text></div>
            ) : (
              <>
                <div className="dashboard-activity-list">
                  {activityItems.map((item, index) => (
                    <div className="dashboard-activity-row" data-first={index === 0 ? 'true' : undefined} key={item.id}>
                      <Stack gap="1">
                        <Text style={{ margin: 0, fontWeight: 700 }}>{item.title}</Text>
                        <Text className="lede" style={{ margin: 0, fontSize: '0.9rem' }}>{item.summary}</Text>
                        <Text className="lede" style={{ margin: 0, fontSize: '0.8rem' }}>
                          {formatTimestamp(item.timestamp)} | Ledger {item.ledger} | Program #{item.programId}
                        </Text>
                      </Stack>
                    </div>
                  ))}
                </div>
                {canLoadMoreActivity ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
                    <Button type="button" variant="outline" size="sm" onClick={() => setActivityLimit((current) => current + ACTIVITY_PAGE_SIZE)} disabled={mercuryFeedLoading}>
                      {mercuryFeedLoading ? 'Loading...' : 'Show more activity'}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </Stack>
        </Card>

      </PageSection>
    </DaoShell>
  );
}
