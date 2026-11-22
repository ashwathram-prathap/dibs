// Property continuation responses omit fields returned in earlier responses.
export function mergeWikipediaPage(previous: any, page: any) {
  return {
    ...previous,
    ...page,
    pageprops: { ...previous?.pageprops, ...page.pageprops },
    redirects: [...(previous?.redirects || []), ...(page.redirects || [])],
  };
}
