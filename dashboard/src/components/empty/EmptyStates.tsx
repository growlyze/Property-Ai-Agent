import React from 'react';
import { Alert, Box, TableCell, TableRow, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

/**
 * Shared empty states for screens whose data source is empty or not connected
 * yet, so they look intentional and consistent (ink border, cream surface).
 */

const INK = '#050d1f';

export function EmptyPanel({
  icon,
  title,
  text,
  action,
  dense = false,
}: {
  icon?: React.ReactNode;
  title: string;
  text?: React.ReactNode;
  action?: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: dense ? 4 : 6, px: 2, maxWidth: 460, mx: 'auto' }}>
      <Box
        sx={{
          width: 52,
          height: 52,
          mx: 'auto',
          mb: 1.5,
          borderRadius: '12px',
          border: `1px solid var(--color-border-default)`,
          bgcolor: '#e2ecff',
          color: '#1554e0',
          display: 'grid',
          placeItems: 'center',
          boxShadow: `0 1px 2px rgba(5,13,31,0.06), 0 8px 24px -12px rgba(5,13,31,0.18)`,
        }}
        aria-hidden
      >
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mb: 0.5 }}>{title}</Typography>
      {text && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: action ? 2 : 0 }}>
          {text}
        </Typography>
      )}
      {action}
    </Box>
  );
}

/** Full-width table row that holds an EmptyPanel. */
export function TableEmptyRow({ colSpan, ...panel }: { colSpan: number } & React.ComponentProps<typeof EmptyPanel>) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ borderBottom: 'none' }}>
        {/* Sticky + viewport-capped so the message stays readable when a wide
            table scrolls sideways on a phone. */}
        <Box sx={{ position: 'sticky', left: 0, width: 'calc(100vw - 64px)', maxWidth: '100%' }}>
          <EmptyPanel dense {...panel} />
        </Box>
      </TableCell>
    </TableRow>
  );
}

/** One-line notice for screens whose backend service is not available yet. */
export function NotConnectedNotice({ children }: { children: React.ReactNode }) {
  return (
    <Alert severity="info" sx={{ mb: 3, border: `1px solid var(--color-border-default)`, textAlign: 'left' }}>
      {children}
    </Alert>
  );
}
