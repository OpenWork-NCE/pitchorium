import { describe, expect, it } from 'vitest';
import { assignableRoles, canManage, isLastOwner } from './roles';

describe('roles of an organisation', () => {
  it('lets owners and admins manage, never a member or a visitor', () => {
    expect(canManage('owner')).toBe(true);
    expect(canManage('admin')).toBe(true);
    expect(canManage('member')).toBe(false);
    expect(canManage(null)).toBe(false);
  });

  it('gives an admin the admin and member roles, never towards or to an owner', () => {
    expect(assignableRoles('owner', 'member')).toEqual(['owner', 'admin', 'member']);
    expect(assignableRoles('admin', 'member')).toEqual(['admin', 'member']);
    expect(assignableRoles('admin', 'owner')).toEqual([]);
    expect(assignableRoles('member', 'member')).toEqual([]);
  });

  it('finds the last owner only when a single owner remains', () => {
    const members = [
      { handle: 'awa', role: 'owner' as const },
      { handle: 'kofi', role: 'admin' as const },
    ];
    expect(isLastOwner(members, 'awa')).toBe(true);
    expect(isLastOwner(members, 'kofi')).toBe(false);
    expect(isLastOwner([...members, { handle: 'ines', role: 'owner' as const }], 'awa')).toBe(
      false,
    );
  });
});
