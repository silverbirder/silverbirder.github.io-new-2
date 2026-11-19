const legacyCmsId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;

export const articleSlug = (id: string) => (legacyCmsId.test(id) ? `cms-${id}` : id);
