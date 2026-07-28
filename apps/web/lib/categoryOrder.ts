// @ts-nocheck
// Resolves a display order for menu categories: any categories the
// business owner has explicitly reordered come first (in that order),
// anything new or not yet placed falls back to alphabetical with Drinks
// always pushed to the end.
export function sortCategories(allCats: string[], customOrder?: string[] | null): string[] {
  const custom = (customOrder ?? []).filter(c => allCats.includes(c))
  const rest = allCats.filter(c => !custom.includes(c))
  const drinksLast = (a: string, b: string) => {
    const aDrinks = a.toLowerCase() === 'drinks', bDrinks = b.toLowerCase() === 'drinks'
    if (aDrinks && !bDrinks) return 1
    if (bDrinks && !aDrinks) return -1
    return a.localeCompare(b)
  }
  rest.sort(drinksLast)
  return [...custom, ...rest]
}
