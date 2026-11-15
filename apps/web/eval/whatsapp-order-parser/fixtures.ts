// Phase B — 40-message eval set for lib/ai/whatsappOrderParser.ts, run by
// scripts/eval-whatsapp-parser.ts against the real Anthropic API (costs
// real tokens; not run as part of the normal unit test suite). A fixed
// fake menu, not real business data, so results are reproducible and
// never touch Supabase.
import type { MenuItemForPrompt } from '@/lib/ai/whatsappOrderParser'

export const MENU: MenuItemForPrompt[] = [
  { id: 'cod',          name: 'Cod',               price: 6.50 },
  { id: 'haddock',      name: 'Haddock',            price: 6.80 },
  { id: 'scampi',       name: 'Scampi',             price: 5.90 },
  { id: 'sausage',      name: 'Sausage',            price: 3.20 },
  { id: 'chips_reg',    name: 'Chips (regular)',    price: 3.50 },
  { id: 'chips_large',  name: 'Chips (large)',      price: 4.50 },
  { id: 'peas',         name: 'Mushy Peas',         price: 1.50 },
  { id: 'curry',        name: 'Curry Sauce',        price: 1.00 },
  { id: 'gravy',        name: 'Gravy',              price: 1.00 },
  { id: 'coke',         name: 'Can of Coke',        price: 1.20 },
  { id: 'water',        name: 'Bottle of Water',    price: 1.00 },
  { id: 'batt_sausage', name: 'Battered Sausage',   price: 3.00 },
  { id: 'fishcake',     name: 'Fish Cake',          price: 2.50 },
  { id: 'onion_rings',  name: 'Onion Rings',        price: 2.80 },
  { id: 'saveloy',      name: 'Saveloy',            price: 3.00 },
]

export type ExpectedItem = { menu_item_id: string | null; quantity: number; price: number }

export type EvalCase = {
  id: string
  message: string
  expectedItems: ExpectedItem[]
  // Soft checks — reported, not required for a pass (natural-language
  // extraction of these is fuzzier than item/price/quantity).
  expectedCustomerNameContains?: string
  expectedNotesContains?: string
}

export const CASES: EvalCase[] = [
  { id: '01', message: 'Can I get a cod and chips please', expectedItems: [{ menu_item_id: 'cod', quantity: 1, price: 6.50 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }] },
  { id: '02', message: 'Can I get 2 portions of cod and chips please', expectedItems: [{ menu_item_id: 'cod', quantity: 2, price: 6.50 }, { menu_item_id: 'chips_reg', quantity: 2, price: 3.50 }] },
  { id: '03', message: 'One haddock, one large chips, one can of coke', expectedItems: [{ menu_item_id: 'haddock', quantity: 1, price: 6.80 }, { menu_item_id: 'chips_large', quantity: 1, price: 4.50 }, { menu_item_id: 'coke', quantity: 1, price: 1.20 }] },
  { id: '04', message: '3x scampi and 3x regular chips', expectedItems: [{ menu_item_id: 'scampi', quantity: 3, price: 5.90 }, { menu_item_id: 'chips_reg', quantity: 3, price: 3.50 }] },
  { id: '05', message: 'Sausage and chips for one please, no peas', expectedItems: [{ menu_item_id: 'sausage', quantity: 1, price: 3.20 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }], expectedNotesContains: 'peas' },
  { id: '06', message: 'Hi can I order 2 fish cakes and a battered sausage', expectedItems: [{ menu_item_id: 'fishcake', quantity: 2, price: 2.50 }, { menu_item_id: 'batt_sausage', quantity: 1, price: 3.00 }] },
  { id: '07', message: '2x chips (regular) with 2x curry sauce', expectedItems: [{ menu_item_id: 'chips_reg', quantity: 2, price: 3.50 }, { menu_item_id: 'curry', quantity: 2, price: 1.00 }] },
  { id: '08', message: 'One cod, one chips, one mushy peas and one gravy', expectedItems: [{ menu_item_id: 'cod', quantity: 1, price: 6.50 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }, { menu_item_id: 'peas', quantity: 1, price: 1.50 }, { menu_item_id: 'gravy', quantity: 1, price: 1.00 }] },
  { id: '09', message: 'Can I get a saveloy and chips, extra vinegar', expectedItems: [{ menu_item_id: 'saveloy', quantity: 1, price: 3.00 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }], expectedNotesContains: 'vinegar' },
  { id: '10', message: '2 cans of coke and 1 bottle of water', expectedItems: [{ menu_item_id: 'coke', quantity: 2, price: 1.20 }, { menu_item_id: 'water', quantity: 1, price: 1.00 }] },
  { id: '11', message: 'One cod, one haddock, two regular chips', expectedItems: [{ menu_item_id: 'cod', quantity: 1, price: 6.50 }, { menu_item_id: 'haddock', quantity: 1, price: 6.80 }, { menu_item_id: 'chips_reg', quantity: 2, price: 3.50 }] },
  { id: '12', message: 'Order: 4x chips (regular), 2x curry sauce', expectedItems: [{ menu_item_id: 'chips_reg', quantity: 4, price: 3.50 }, { menu_item_id: 'curry', quantity: 2, price: 1.00 }] },
  { id: '13', message: 'Can I have onion rings and a can of coke', expectedItems: [{ menu_item_id: 'onion_rings', quantity: 1, price: 2.80 }, { menu_item_id: 'coke', quantity: 1, price: 1.20 }] },
  { id: '14', message: 'Two sausage and chips meals please', expectedItems: [{ menu_item_id: 'sausage', quantity: 2, price: 3.20 }, { menu_item_id: 'chips_reg', quantity: 2, price: 3.50 }] },
  { id: '15', message: "I'll have one scampi with one large chips and one mushy peas", expectedItems: [{ menu_item_id: 'scampi', quantity: 1, price: 5.90 }, { menu_item_id: 'chips_large', quantity: 1, price: 4.50 }, { menu_item_id: 'peas', quantity: 1, price: 1.50 }] },
  { id: '16', message: "Hey it's Sarah, can I get a cod and chips, pickup at 7pm", expectedItems: [{ menu_item_id: 'cod', quantity: 1, price: 6.50 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }], expectedCustomerNameContains: 'Sarah' },
  { id: '17', message: "My name's Dave — one haddock and chips please", expectedItems: [{ menu_item_id: 'haddock', quantity: 1, price: 6.80 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }], expectedCustomerNameContains: 'Dave' },
  { id: '18', message: '3 battered sausages, no sauce', expectedItems: [{ menu_item_id: 'batt_sausage', quantity: 3, price: 3.00 }], expectedNotesContains: 'sauce' },
  { id: '19', message: 'Can we get 5x regular chips for the office', expectedItems: [{ menu_item_id: 'chips_reg', quantity: 5, price: 3.50 }] },
  { id: '20', message: 'One cod, one chips, one peas, one gravy — one of each small', expectedItems: [{ menu_item_id: 'cod', quantity: 1, price: 6.50 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }, { menu_item_id: 'peas', quantity: 1, price: 1.50 }, { menu_item_id: 'gravy', quantity: 1, price: 1.00 }] },
  { id: '21', message: '2 haddock and 1 large chips to share, with 1 extra curry sauce', expectedItems: [{ menu_item_id: 'haddock', quantity: 2, price: 6.80 }, { menu_item_id: 'chips_large', quantity: 1, price: 4.50 }, { menu_item_id: 'curry', quantity: 1, price: 1.00 }] },
  { id: '22', message: 'A fish cake, an onion rings, and a coke', expectedItems: [{ menu_item_id: 'fishcake', quantity: 1, price: 2.50 }, { menu_item_id: 'onion_rings', quantity: 1, price: 2.80 }, { menu_item_id: 'coke', quantity: 1, price: 1.20 }] },
  { id: '23', message: 'Cod and chips, make that two of each please', expectedItems: [{ menu_item_id: 'cod', quantity: 2, price: 6.50 }, { menu_item_id: 'chips_reg', quantity: 2, price: 3.50 }] },
  { id: '24', message: '1x scampi 1x regular chips 1x mushy peas, no gravy thanks', expectedItems: [{ menu_item_id: 'scampi', quantity: 1, price: 5.90 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }, { menu_item_id: 'peas', quantity: 1, price: 1.50 }], expectedNotesContains: 'gravy' },
  { id: '25', message: 'Hiya, 2 sausages, no chips, just 1 peas and 1 gravy', expectedItems: [{ menu_item_id: 'sausage', quantity: 2, price: 3.20 }, { menu_item_id: 'peas', quantity: 1, price: 1.50 }, { menu_item_id: 'gravy', quantity: 1, price: 1.00 }] },
  { id: '26', message: 'Can I get 6 large chips, 2 curry sauce, 2 gravy for a group', expectedItems: [{ menu_item_id: 'chips_large', quantity: 6, price: 4.50 }, { menu_item_id: 'curry', quantity: 2, price: 1.00 }, { menu_item_id: 'gravy', quantity: 2, price: 1.00 }] },
  { id: '27', message: 'One saveloy and a bottle of water please', expectedItems: [{ menu_item_id: 'saveloy', quantity: 1, price: 3.00 }, { menu_item_id: 'water', quantity: 1, price: 1.00 }] },
  { id: '28', message: 'Double cod, double chips', expectedItems: [{ menu_item_id: 'cod', quantity: 2, price: 6.50 }, { menu_item_id: 'chips_reg', quantity: 2, price: 3.50 }] },
  { id: '29', message: "Hi, it's Mike, order is 1 haddock and 1 regular chips, pickup 6:30", expectedItems: [{ menu_item_id: 'haddock', quantity: 1, price: 6.80 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }], expectedCustomerNameContains: 'Mike' },
  { id: '30', message: '3 cans of coke please', expectedItems: [{ menu_item_id: 'coke', quantity: 3, price: 1.20 }] },
  { id: '31', message: 'Can I have one cod and one large chips instead of regular', expectedItems: [{ menu_item_id: 'cod', quantity: 1, price: 6.50 }, { menu_item_id: 'chips_large', quantity: 1, price: 4.50 }] },
  { id: '32', message: 'One sausage, one chips, one peas, one gravy, one curry sauce — the lot', expectedItems: [{ menu_item_id: 'sausage', quantity: 1, price: 3.20 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }, { menu_item_id: 'peas', quantity: 1, price: 1.50 }, { menu_item_id: 'gravy', quantity: 1, price: 1.00 }, { menu_item_id: 'curry', quantity: 1, price: 1.00 }] },
  { id: '33', message: '2x onion rings only, nothing else', expectedItems: [{ menu_item_id: 'onion_rings', quantity: 2, price: 2.80 }] },
  { id: '34', message: 'Order for Lucy: one cod and chips, no peas, pickup at 5', expectedItems: [{ menu_item_id: 'cod', quantity: 1, price: 6.50 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }], expectedCustomerNameContains: 'Lucy', expectedNotesContains: 'peas' },
  { id: '35', message: '4 fish cakes and 4 regular chips for the kids', expectedItems: [{ menu_item_id: 'fishcake', quantity: 4, price: 2.50 }, { menu_item_id: 'chips_reg', quantity: 4, price: 3.50 }] },
  { id: '36', message: 'One battered sausage, one saveloy, one regular chips to share', expectedItems: [{ menu_item_id: 'batt_sausage', quantity: 1, price: 3.00 }, { menu_item_id: 'saveloy', quantity: 1, price: 3.00 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }] },
  { id: '37', message: 'Can we get two bottles of water and one can of coke', expectedItems: [{ menu_item_id: 'water', quantity: 2, price: 1.00 }, { menu_item_id: 'coke', quantity: 1, price: 1.20 }] },
  { id: '38', message: 'Hiya can I get one mushy peas and one gravy only, nothing else', expectedItems: [{ menu_item_id: 'peas', quantity: 1, price: 1.50 }, { menu_item_id: 'gravy', quantity: 1, price: 1.00 }] },
  { id: '39', message: 'Large chips x3 and curry sauce x1', expectedItems: [{ menu_item_id: 'chips_large', quantity: 3, price: 4.50 }, { menu_item_id: 'curry', quantity: 1, price: 1.00 }] },
  // Deliberately off-menu item — exercises the "menu_item_id null, price 0" rule.
  { id: '40', message: 'Hi can I order a kebab and one regular chips', expectedItems: [{ menu_item_id: null, quantity: 1, price: 0 }, { menu_item_id: 'chips_reg', quantity: 1, price: 3.50 }] },
]
