# Architecture rules
- Keep Team member detail pages under the authenticated Team routes and load member information through tenant-scoped admin APIs, so links cannot expose another tenant's profile.