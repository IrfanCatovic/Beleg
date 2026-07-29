export const clubMemberKeys = {
  all: ['korisnici'] as const,
  manage: ['korisnici', 'club-manage'] as const,
  list: ['korisnici', 'club'] as const,
}

export const publicClubKeys = {
  all: ['public-club'] as const,
  detail: (clubId: number) => ['public-club', 'detail', clubId] as const,
}

