import { useState } from 'react';

/**
 * In-session merchant shop state.
 *
 * Groups all useState calls related to the MerchantShop panel flow so
 * DMSession.jsx isn't carrying 19 raw top-level state slots for one
 * feature. The hook is intentionally a straight bundle — same semantics
 * as before, just colocated. Handler logic still lives in DMSession.jsx
 * (it orchestrates many subsystems at once); this hook isolates the
 * state layer so it's easy to reason about the shop's lifecycle:
 *
 *   pending → detected (AI emitted [MERCHANT_SHOP])
 *   shopOpen → player opened the panel
 *   merchantInventory / buybackItems → loaded from server
 *   shopCart → buying/selling drafts
 *   haggle* → roll-then-apply negotiation state
 *   lastMerchantContext → snapshot for later "return to this shop"
 *   merchantDbId / personality / gold / price modifiers → merchant record
 *
 * Destructure what you need in the consumer:
 *
 *   const { pendingMerchantShop, setPendingMerchantShop, ... } = useMerchantShop();
 */
export function useMerchantShop() {
  // Shop detection + active-shop lifecycle
  const [pendingMerchantShop, setPendingMerchantShop] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [lastMerchantContext, setLastMerchantContext] = useState(null);

  // Loaded merchant state
  const [merchantInventory, setMerchantInventory] = useState([]);
  const [buybackItems, setBuybackItems] = useState([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantDbId, setMerchantDbId] = useState(null);
  const [merchantPersonality, setMerchantPersonality] = useState(null);
  const [merchantGold, setMerchantGold] = useState(null);
  const [merchantPriceModifier, setMerchantPriceModifier] = useState(null);
  const [merchantEconomyModifiers, setMerchantEconomyModifiers] = useState(null);

  // Cart (player buying/selling drafts)
  const [shopCart, setShopCart] = useState({ buying: [], selling: [] });
  const [transactionProcessing, setTransactionProcessing] = useState(false);

  // Haggle mechanic
  const [haggleRoller, setHaggleRoller] = useState('character');
  const [haggleSkill, setHaggleSkill] = useState('Persuasion');
  const [haggleResult, setHaggleResult] = useState(null);
  const [hagglingInFlight, setHagglingInFlight] = useState(false);
  const [haggleAttempts, setHaggleAttempts] = useState(0);

  return {
    pendingMerchantShop, setPendingMerchantShop,
    shopOpen, setShopOpen,
    lastMerchantContext, setLastMerchantContext,
    merchantInventory, setMerchantInventory,
    buybackItems, setBuybackItems,
    merchantLoading, setMerchantLoading,
    merchantDbId, setMerchantDbId,
    merchantPersonality, setMerchantPersonality,
    merchantGold, setMerchantGold,
    merchantPriceModifier, setMerchantPriceModifier,
    merchantEconomyModifiers, setMerchantEconomyModifiers,
    shopCart, setShopCart,
    transactionProcessing, setTransactionProcessing,
    haggleRoller, setHaggleRoller,
    haggleSkill, setHaggleSkill,
    haggleResult, setHaggleResult,
    hagglingInFlight, setHagglingInFlight,
    haggleAttempts, setHaggleAttempts
  };
}
