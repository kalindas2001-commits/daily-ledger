---
name: Team onboarding
description: Invite codes, admin-created users, and tenant quota enforcement
type: feature
---
Signup has 3 tabs: Sign In, Create Business (new admin/tenant), Join with Code (joins existing tenant as 'user').

- `tenant_invites` table: code (8 chars), max_uses, uses, expires_at, revoked, note.
- RPCs: `admin_create_invite(_max_uses,_expires_hours,_note)`, `admin_list_invites`, `admin_revoke_invite`, `peek_invite(code)` (anon-callable for signup validation), `redeem_invite_for(uid,code)`.
- `handle_new_profile` trigger: if `raw_user_meta_data.invite_code` is present and valid, attach new user to that tenant with role 'user' and increment invite uses; otherwise create new tenant + role 'admin' as before.
- Edge function `admin-create-user`: tenant admin creates user inside their tenant. Service-role; checks caller role, quota, then deletes the trigger-spawned orphan tenant and moves new profile + role into admin's tenant.
- UI: `/team` route → `TeamMembers` component (admins only). Shows seat usage, create-user dialog, invite-code generator with copy/revoke, member list with enable/disable.
- All paths block when `profiles.count(tenant_id) >= tenants.max_users`. Admin should request quota increase from super admin.
