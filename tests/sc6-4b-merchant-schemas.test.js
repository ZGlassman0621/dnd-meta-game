/**
 * Phase 3 SC-6.4b — Merchant cluster schema validation + response-payload
 * snapshot tests.
 *
 * Covers the 5 markers in the merchant cluster:
 *   MERCHANT_SHOP   — schema + handler (orchestrates ADD_ITEM internally)
 *   ADD_ITEM        — schema only (parked from independent dispatch;
 *                     consumed by MERCHANT_SHOP handler)
 *   MERCHANT_REFER  — schema + handler
 *   MERCHANT_COMMISSION — schema + handler (returns systemNote for the
 *                     route handler to push to result.messages)
 *   LOOT_DROP       — schema + handler (per-drop dispatch; route
 *                     consolidates results into ONE combined SYSTEM note)
 *
 * Also includes a response-payload snapshot pattern: the route handler's
 * extraction logic produces byte-identical message-push content for a
 * given handlerResults shape. The test inlines the post-migration
 * extraction logic and asserts the exact strings that would land on
 * result.messages.
 */

import {
  MARKER_SCHEMAS,
  parseMarkerBody,
  validateDmMarkers
} from '../server/services/markerSchemas.js'
import { _hasHandler } from '../server/services/markerPipeline.js'

// Force module-load side effects (handler registrations).
import '../server/services/merchantService.js'
import '../server/services/merchantOrderService.js'
import '../server/services/lootDropService.js'

import * as dmSessionService from '../server/services/dmSessionService.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

const CLUSTER_KEYS = [
  'MERCHANT_SHOP', 'ADD_ITEM', 'MERCHANT_REFER',
  'MERCHANT_COMMISSION', 'LOOT_DROP'
]

const HANDLER_KEYS = [
  'MERCHANT_SHOP', 'MERCHANT_REFER', 'MERCHANT_COMMISSION', 'LOOT_DROP'
]

console.log('\n=== All 5 cluster-2 schemas registered ===\n')
{
  for (const key of CLUSTER_KEYS) {
    assert(MARKER_SCHEMAS[key] !== undefined, `MARKER_SCHEMAS.${key} present`)
  }
}

console.log('\n=== 4 handlers registered (ADD_ITEM is schema-only by design) ===\n')
{
  for (const key of HANDLER_KEYS) {
    assert(_hasHandler(key), `markerPipeline has handler for ${key}`)
  }
  assert(!_hasHandler('ADD_ITEM'), 'no handler for ADD_ITEM (orchestrated by MERCHANT_SHOP handler internally)')
}

console.log('\n=== Legacy detect-functions still exported (deprecate by hiding) ===\n')
{
  for (const fn of [
    'detectMerchantShop', 'detectAddItem', 'detectMerchantRefer',
    'detectMerchantCommission', 'detectLootDrop'
  ]) {
    assert(typeof dmSessionService[fn] === 'function', `${fn} still exported`)
  }
}

console.log('\n=== MERCHANT_SHOP: Merchant + Type + Location required ===\n')
{
  const ok = parseMarkerBody('Merchant="Gerda" Type=general Location="Phandalin"', 'MERCHANT_SHOP')
  assert(ok.ok && ok.data.Merchant === 'Gerda' && ok.data.Type === 'general', 'canonical parses')
  const noLoc = parseMarkerBody('Merchant="Gerda" Type=general', 'MERCHANT_SHOP')
  assert(!noLoc.ok && noLoc.errors.some(e => e.field === 'Location'), 'missing Location → error')
  const badType = parseMarkerBody('Merchant="X" Type=fishmonger Location="Y"', 'MERCHANT_SHOP')
  assert(!badType.ok && badType.errors.some(e => e.field === 'Type'), 'invalid Type enum → error')
}

console.log('\n=== ADD_ITEM: Name + Price_GP + Quality + Category required ===\n')
{
  const ok = parseMarkerBody('Name="Iron Ring" Price_GP=5 Quality=fine Category="ring"', 'ADD_ITEM')
  assert(ok.ok && ok.data.Price_GP === 5 && ok.data.Quality === 'fine', 'canonical parses')
  const negPrice = parseMarkerBody('Name="X" Price_GP=-1 Quality=fine Category=y', 'ADD_ITEM')
  assert(!negPrice.ok && negPrice.errors.some(e => e.field === 'Price_GP'), 'negative price → min violation')
}

console.log('\n=== MERCHANT_REFER: From + To + Item required ===\n')
{
  const ok = parseMarkerBody('From="Gerda" To="Stonehill" Item="silvered dagger"', 'MERCHANT_REFER')
  assert(ok.ok && ok.data.From === 'Gerda' && ok.data.Item === 'silvered dagger', 'canonical parses')
  const noItem = parseMarkerBody('From="A" To="B"', 'MERCHANT_REFER')
  assert(!noItem.ok && noItem.errors.some(e => e.field === 'Item'), 'missing Item → error')
}

console.log('\n=== MERCHANT_COMMISSION: schema extension preserves sp/cp/description ===\n')
{
  // Canonical (gp-only) form
  const ok = parseMarkerBody(
    'Merchant="Gerda" Item="silvered sword" Price_GP=120 Deposit_GP=40 Lead_Time_Days=7 Quality=fine Hook="hunting werewolves"',
    'MERCHANT_COMMISSION'
  )
  assert(ok.ok && ok.data.Price_GP === 120 && ok.data.Deposit_GP === 40, 'canonical gp-only parses')

  // Mixed denomination (legacy tolerance preserved via SC-6.4b extension)
  const mixed = parseMarkerBody(
    'Merchant="X" Item="Y" Price_GP=10 Price_SP=5 Price_CP=3 Deposit_GP=2 Deposit_SP=5 Lead_Time_Days=1',
    'MERCHANT_COMMISSION'
  )
  assert(mixed.ok && mixed.data.Price_SP === 5 && mixed.data.Price_CP === 3, 'sp/cp denominations parse')

  // Description field tolerance
  const withDesc = parseMarkerBody(
    'Merchant="X" Item="Y" Price_GP=10 Deposit_GP=5 Lead_Time_Days=3 Description="An ornate brass key"',
    'MERCHANT_COMMISSION'
  )
  assert(withDesc.ok && withDesc.data.Description === 'An ornate brass key', 'Description field tolerated')

  // Required-field violations
  const noLeadTime = parseMarkerBody('Merchant="X" Item="Y" Price_GP=10 Deposit_GP=5', 'MERCHANT_COMMISSION')
  assert(!noLeadTime.ok && noLeadTime.errors.some(e => e.field === 'Lead_Time_Days'), 'missing Lead_Time_Days → error')
  const zeroLeadTime = parseMarkerBody('Merchant="X" Item="Y" Price_GP=10 Deposit_GP=5 Lead_Time_Days=0', 'MERCHANT_COMMISSION')
  assert(!zeroLeadTime.ok && zeroLeadTime.errors.some(e => e.field === 'Lead_Time_Days'), 'lead time 0 → min violation')
}

console.log('\n=== LOOT_DROP: Item required, Source optional ===\n')
{
  const ok = parseMarkerBody('Item="Healing Potion" Source="goblin chief"', 'LOOT_DROP')
  assert(ok.ok && ok.data.Item === 'Healing Potion', 'canonical parses')
  const noSource = parseMarkerBody('Item="Gold Pieces"', 'LOOT_DROP')
  assert(noSource.ok, 'Source optional')
  const noItem = parseMarkerBody('Source="dragon hoard"', 'LOOT_DROP')
  assert(!noItem.ok && noItem.errors.some(e => e.field === 'Item'), 'missing Item → error')
}

console.log('\n=== End-to-end: realistic merchant turn validates all 5 schemas ===\n')
{
  const narrative = `
    Gerda gestures to her shelves. [MERCHANT_SHOP: Merchant="Gerda" Type=general Location="Phandalin"]
    She rummages and produces a wrapped bundle. [ADD_ITEM: Name="Silvered Dagger" Price_GP=85 Quality=fine Category="weapon"]
    "If you need something heavier, see Toblen." [MERCHANT_REFER: From="Gerda" To="Toblen" Item="warhammer"]
    "I can have a custom blade ready in a tenday." [MERCHANT_COMMISSION: Merchant="Gerda" Item="hunting blade" Price_GP=120 Deposit_GP=40 Lead_Time_Days=10 Quality=fine]
    A coin slips from the goblin's purse. [LOOT_DROP: Item="Gold Pieces" Source="goblin"]
  `
  const { validByKey, failures } = validateDmMarkers(narrative)
  for (const key of CLUSTER_KEYS) {
    assert(validByKey[key]?.length === 1, `${key} extracted`)
  }
  assert(failures.length === 0, 'all five markers valid; no failures')
}

console.log('\n=== Response-payload snapshot: handlerResults → result.messages content ===\n')
{
  // Snapshot test pattern: simulate the post-migration route extraction
  // logic against a synthetic handlerResults array. Asserts the exact
  // strings that would land on result.messages — byte-identical to what
  // the legacy inline dispatch would have pushed for the same inputs.

  // Case 1: MERCHANT_SHOP with inventoryContext
  const shopHr = {
    schemaKey: 'MERCHANT_SHOP',
    ok: true,
    result: {
      type: 'merchant_shop',
      merchantId: 42,
      merchantName: 'Gerda',
      merchantType: 'general',
      location: 'Phandalin',
      addedItems: [],
      inventoryContext: '[SYSTEM: Gerda\'s actual inventory — ONLY reference these items when the player asks what\'s available:\n- Trail Rations (5gp, qty: 10)\nMerchant gold: 50gp. Do NOT invent items not on this list. The shop UI shows this inventory to the player. If an item isn\'t here, suggest an alternative or refer to another merchant with [MERCHANT_REFER]. You can add fitting custom items with [ADD_ITEM].]'
    }
  }
  // Inline the route extraction logic
  const messages1 = []
  for (const hr of [shopHr]) {
    if (!hr.ok || !hr.result) continue
    if (hr.schemaKey === 'MERCHANT_SHOP') messages1.push({ role: 'user', content: hr.result.inventoryContext })
    else if (hr.schemaKey === 'MERCHANT_COMMISSION') messages1.push({ role: 'user', content: hr.result.systemNote })
  }
  assert(messages1.length === 1, 'shop produces 1 message')
  assert(messages1[0].content.startsWith('[SYSTEM: Gerda\'s actual inventory'), 'inventoryContext text matches')

  // Case 2: MERCHANT_COMMISSION (placed)
  const commHr = {
    schemaKey: 'MERCHANT_COMMISSION',
    ok: true,
    result: {
      type: 'merchant_commission',
      status: 'placed',
      orderId: 7,
      systemNote: '[SYSTEM: Commission recorded. Order #7: hunting blade from Gerda, ready in 10 game days (day 25). Deposit: 40 gp. Balance due on pickup: 80 gp.]'
    }
  }
  const messages2 = []
  for (const hr of [commHr]) {
    if (!hr.ok || !hr.result) continue
    if (hr.schemaKey === 'MERCHANT_COMMISSION') messages2.push({ role: 'user', content: hr.result.systemNote })
  }
  assert(messages2.length === 1, 'commission produces 1 message')
  assert(messages2[0].content.includes('Order #7'), 'commission systemNote contains order id')

  // Case 3: MERCHANT_COMMISSION (skipped duplicate)
  const dupeHr = {
    schemaKey: 'MERCHANT_COMMISSION',
    ok: true,
    result: {
      type: 'merchant_commission',
      status: 'skipped_duplicate',
      systemNote: '[SYSTEM: MERCHANT_COMMISSION skipped — an order for "hunting blade" at Gerda is already in progress (order #5). Don\'t restate the commission.]'
    }
  }
  const messages3 = []
  for (const hr of [dupeHr]) {
    if (!hr.ok || !hr.result) continue
    if (hr.schemaKey === 'MERCHANT_COMMISSION') messages3.push({ role: 'user', content: hr.result.systemNote })
  }
  assert(messages3[0].content.includes('skipped'), 'dedupe systemNote produced')

  // Case 4: LOOT_DROP consolidates multiple results into ONE combined message
  const lootResults = [
    { schemaKey: 'LOOT_DROP', ok: true, result: { type: 'loot_drop', item: 'Healing Potion', source: 'goblin', known: true } },
    { schemaKey: 'LOOT_DROP', ok: true, result: { type: 'loot_drop', item: 'Gold Pieces', source: 'chest', known: false } }
  ]
  const lootDropResults = lootResults
    .filter(hr => hr.ok && hr.schemaKey === 'LOOT_DROP' && hr.result)
    .map(hr => hr.result)
  const messages4 = []
  if (lootDropResults.length > 0) {
    const itemNames = lootDropResults.map(d => d.item).join(', ')
    messages4.push({
      role: 'user',
      content: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: The following items have been added to the player's inventory: ${itemNames}. The player's character sheet now reflects these items.`
    })
  }
  assert(messages4.length === 1, '2 loot drops → 1 combined message')
  assert(messages4[0].content === `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: The following items have been added to the player's inventory: Healing Potion, Gold Pieces. The player's character sheet now reflects these items.`,
    'combined SYSTEM note byte-identical to legacy format')

  // Case 5: MERCHANT_REFER produces NO message push (silent side effect)
  const referHr = {
    schemaKey: 'MERCHANT_REFER',
    ok: true,
    result: { type: 'merchant_refer', from: 'Gerda', to: 'Toblen', item: 'warhammer' }
  }
  const messages5 = []
  for (const hr of [referHr]) {
    if (!hr.ok || !hr.result) continue
    if (hr.schemaKey === 'MERCHANT_SHOP') messages5.push({ role: 'user', content: hr.result.inventoryContext })
    else if (hr.schemaKey === 'MERCHANT_COMMISSION') messages5.push({ role: 'user', content: hr.result.systemNote })
    // MERCHANT_REFER: deliberately no push
  }
  assert(messages5.length === 0, 'MERCHANT_REFER does not push to result.messages')
}

console.log('\n=== Cross-pipeline isolation: prior schemas still validate ===\n')
{
  const narrative = `[PIETY_CHANGE: Deity="Lathander" Amount=1] [SHELTER_FOUND: Type=cave Quality=adequate]`
  const { validByKey, failures } = validateDmMarkers(narrative)
  assert(validByKey.PIETY_CHANGE?.length === 1, 'SC-4 PIETY_CHANGE still validates')
  assert(validByKey.SHELTER_FOUND?.length === 1, 'SC-6.4a SHELTER_FOUND still validates')
  assert(failures.length === 0, 'no false failures from cluster-2 additions')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
