import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardContent, Chip, Divider, Stack } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import tenantPortalService from '../../services/tenantPortalService';
import { EmptyState, ErrorNote, ListRow, Loading, PageHeader, PageShell, fmtDate, pretty } from '../../components/portal/PortalUI';

const size = (bytes?: number | null) => {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const TenantDocuments: React.FC = () => {
  const q = useQuery({ queryKey: ['tenant-documents'], queryFn: () => tenantPortalService.getDocuments(1, 100), retry: false });
  const docs = q.data?.data ?? [];

  return (
    <PageShell>
      <PageHeader title="Documents" subtitle="Your lease and other documents shared with you." />
      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          {q.isLoading ? (
            <Loading />
          ) : q.isError ? (
            <ErrorNote text="Could not load your documents." onRetry={() => q.refetch()} />
          ) : docs.length === 0 ? (
            <EmptyState title="No documents yet" text="Documents your property manager shares with you will appear here." />
          ) : (
            <Stack divider={<Divider flexItem />} spacing={1.5} data-testid="tenant-documents-list">
              {docs.map((d) => (
                <ListRow
                  key={d.id}
                  primary={d.name}
                  secondary={[d.description, d.propertyName, fmtDate(d.uploadedAt || d.updatedAt), size(d.fileSize)]
                    .filter(Boolean)
                    .join(' · ')}
                  right={
                    <>
                      {d.type && <Chip size="small" label={pretty(d.type)} variant="outlined" />}
                      {d.fileUrl && (
                        <Button
                          size="small"
                          variant="outlined"
                          endIcon={<OpenInNewIcon />}
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </Button>
                      )}
                    </>
                  }
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default TenantDocuments;
