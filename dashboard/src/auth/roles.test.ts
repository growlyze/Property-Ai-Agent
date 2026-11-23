import { canAccess, homePathFor, navItemsFor, roleLabel } from './roles';

const hrefs = (role: string) => {
  const out: string[] = [];
  const walk = (items: ReturnType<typeof navItemsFor>) =>
    items.forEach((i) => {
      out.push(i.href);
      if (i.children) walk(i.children);
    });
  walk(navItemsFor(role));
  return out;
};

describe('role policy', () => {
  it('gives admins everything except the portals', () => {
    expect(canAccess('ADMIN', '/access-control')).toBe(true);
    expect(canAccess('ADMIN', '/financial-reports')).toBe(true);
    expect(canAccess('ADMIN', '/my/payments')).toBe(false);
  });

  it('hides admin-only pages from managers and owners', () => {
    for (const role of ['PROPERTY_MANAGER', 'OWNER']) {
      expect(canAccess(role, '/access-control')).toBe(false);
      expect(canAccess(role, '/security-settings')).toBe(false);
      expect(canAccess(role, '/forms-showcase')).toBe(false);
      expect(canAccess(role, '/properties')).toBe(true);
      expect(canAccess(role, '/vendor-performance')).toBe(true);
      expect(canAccess(role, '/rentals/abc/edit')).toBe(true);
    }
  });

  it('limits tenants and vendors to their portal', () => {
    expect(canAccess('TENANT', '/')).toBe(true);
    expect(canAccess('TENANT', '/my/maintenance')).toBe(true);
    expect(canAccess('TENANT', '/properties')).toBe(false);
    expect(canAccess('TENANT', '/vendor/jobs')).toBe(false);
    expect(canAccess('VENDOR', '/vendor/jobs')).toBe(true);
    expect(canAccess('VENDOR', '/vendor-bidding')).toBe(false);
    expect(canAccess('VENDOR', '/my/payments')).toBe(false);
    expect(canAccess('VENDOR', '/financial-reports')).toBe(false);
  });

  it('only lists menu entries the role can open', () => {
    for (const role of ['ADMIN', 'PROPERTY_MANAGER', 'OWNER', 'TENANT', 'VENDOR']) {
      for (const h of hrefs(role)) expect(canAccess(role, h)).toBe(true);
    }
    expect(hrefs('PROPERTY_MANAGER')).not.toContain('/access-control');
    expect(hrefs('ADMIN')).toContain('/access-control');
    expect(hrefs('TENANT')).toEqual(['/', '/my/payments', '/my/maintenance', '/my/documents', '/my/notifications']);
  });

  it('labels roles and sends everyone home to /', () => {
    expect(roleLabel('PROPERTY_MANAGER')).toBe('Property manager');
    expect(roleLabel('vendor')).toBe('Vendor');
    expect(homePathFor('TENANT')).toBe('/');
    expect(canAccess('SOMETHING_ELSE', '/properties')).toBe(false);
  });
});
