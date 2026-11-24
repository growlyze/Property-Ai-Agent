import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  Link,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { dashboardService, Property } from '../services/dashboardService';
import { ErrorNote, Loading, StatusChip, fmtDate, money, pretty } from '../components/portal/PortalUI';

const PAGE_SIZE = 10;
/** While searching we load one larger page and filter/paginate it here, so search also
 *  works against an API that ignores `search`. */
const SEARCH_FETCH_LIMIT = 100;

const matches = (p: any, term: string) =>
  [p.title, p.address, p.city, p.state, p.zipCode, p.unitNumber, p.propertyType]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(term));

/**
 * Properties list. "Properties" are the Rental records (one per unit) exposed through
 * GET /api/properties; each row links to its rental detail page.
 */
const PropertyList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const query = useQuery({
    queryKey: ['properties-list', search ? 'search' : page, search],
    queryFn: () =>
      search
        ? dashboardService.getProperties(1, SEARCH_FETCH_LIMIT, search)
        : dashboardService.getProperties(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const { rows, total } = useMemo(() => {
    const data: Property[] = Array.isArray(query.data?.data) ? query.data!.data : [];
    if (!search) return { rows: data, total: query.data?.total ?? data.length };
    const filtered = data.filter((p) => matches(p, search.toLowerCase()));
    return { rows: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: filtered.length };
  }, [query.data, search, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Box sx={{ textAlign: 'left' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            Properties
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {query.isLoading ? 'Loading…' : `${total} ${total === 1 ? 'unit' : 'units'}${search ? ` matching “${search}”` : ''}`}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/rentals/new" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
          Add property
        </Button>
      </Stack>

      <TextField
        size="small"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search by name, address, city or unit…"
        inputProps={{ 'aria-label': 'Search properties' }}
        sx={{ mb: 2, width: { xs: '100%', sm: 420 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {query.isError && (
        <Box sx={{ mb: 2 }}>
          <ErrorNote text="Could not load properties." onRetry={() => query.refetch()} />
        </Box>
      )}

      {query.isLoading ? (
        <Loading />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table aria-label="Properties" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Property</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Rent</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Availability</TableCell>
                <TableCell>Added</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((p: any) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <Link component={RouterLink} to={`/rentals/${p.id}`} underline="hover" sx={{ fontWeight: 700 }}>
                      {p.title || p.address}
                    </Link>
                  </TableCell>
                  <TableCell>{[p.address, p.city, p.state].filter(Boolean).join(', ')}</TableCell>
                  <TableCell>{pretty(p.propertyType) || '—'}</TableCell>
                  <TableCell align="right">{p.rent != null ? money(Number(p.rent)) : '—'}</TableCell>
                  <TableCell>
                    <StatusChip status={p.status} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={p.isAvailable ? 'success' : 'default'}
                      label={p.isAvailable ? 'Available' : 'Let'}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(p.createdAt)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {search ? `No properties match “${search}”.` : 'No properties yet. Add your first one to get started.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" aria-label="Property list pagination" />
        </Box>
      )}
    </Box>
  );
};

export default PropertyList;
