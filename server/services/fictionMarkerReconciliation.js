/**
 * Fiction-Marker Reconciliation (Structural #9: P2-A).
 * Strict both directions: Fiction says damage -> DB must reflect it.
 * DB has damage -> narration must describe it.
 */
import { applyHpChange } from './characterHpService.js';

export function extractDamageClaims(narration) {
  if (!narration || typeof narration !== 'string') return [];
  const claims = [];
  const patterns = [
    /takes?\s+(\d+)\s+(?:points?\s+of\s+)?damage/gi,
    /hits?\s+for\s+(\d+)(?:\s+damage)?/gi,
    /deals?\s+(\d+)\s+damage/gi,
    /suffers?\s+(\d+)\s+(?:points?\s+of\s+)?damage/gi,
    /(\d+)\s+damage\s+to\s+([^.,;]+)/gi,
    /inflicts?\s+(\d+)\s+damage/gi,
  ];
  const seen = [];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(narration)) !== null) {
      const s = m.index, e = s + m[0].length;
      if (seen.some(([a,b]) => s < b && e > a)) continue;
      seen.push([s,e]);
      claims.push({ amount: parseInt(m[1],10), targetHint: m[2]?.trim()||null, context: m[0] });
    }
  }
  return claims;
}

export function extractDeathClaims(narration) {
  if (!narration || typeof narration !== 'string') return [];
  const claims = [];
  const patterns = [/([^.,;]+?)\s+(?:falls?\s+)?dead/gi, /([^.,;]+?)\s+is\s+slain/gi, /([^.,;]+?)\s+dies(?!\s+from)/gi, /kills?\s+([^.,;]+)/gi];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(narration)) !== null) {
      const t = m[1]?.trim();
      if (t && t.length > 2 && t.length < 50) claims.push({ targetHint: t, context: m[0] });
    }
  }
  return claims;
}

export function narrationMentionsEffect(narration, effect) {
  if (!narration || !effect) return false;
  const lower = narration.toLowerCase();
  if (effect.type === 'hp_change') {
    const words = effect.delta < 0 ? ['damage','hit','wound','hurt','strike'] : ['heal','restore','recover','mend'];
    return words.some(w => lower.includes(w));
  }
  if (effect.type === 'enemy_damage') {
    return lower.includes((effect.enemyName||'').toLowerCase()) && ['damage','hit','wound','strike','blood','fall','die','kill'].some(w => lower.includes(w));
  }
  if (effect.type === 'condition') return lower.includes((effect.condition||'').toLowerCase());
  return false;
}

export async function reconcileTurn(narration, markersApplied, context) {
  const result = { autoApplied: [], missingFiction: [], verified: [] };
  if (!context?.characterId) return result;
  const damageClaims = extractDamageClaims(narration);
  for (const claim of damageClaims) {
    const covered = (markersApplied||[]).some(m => {
      if (m?.schemaKey==='HP_CHANGE' && m?.result?.applied) return Math.abs(m.result.delta)===claim.amount;
      if (m?.schemaKey==='ENEMY_DAMAGE' && m?.result?.damageDealt) return m.result.damageDealt===claim.amount;
      if (m?.schemaKey==='ENEMY_ATTACK' && m?.result?.damage) return m.result.damage===claim.amount;
      return false;
    });
    if (!covered) {
      const hpResult = await applyHpChange(context.characterId, -claim.amount, 'reconciliation: narrated damage');
      if (hpResult?.applied) result.autoApplied.push({ type:'hp_change', amount:claim.amount, context:claim.context, hpResult });
    } else result.verified.push({ type:'damage_claim', amount:claim.amount, matched:true });
  }
  for (const m of (markersApplied||[])) {
    if (!m?.schemaKey || !m?.result) continue;
    let effect = null;
    if (m.schemaKey==='HP_CHANGE' && m.result.applied) effect={type:'hp_change',delta:m.result.delta};
    else if (m.schemaKey==='ENEMY_DAMAGE' && m.result.damageDealt>0) effect={type:'enemy_damage',enemyName:m.result.enemyName,killed:m.result.killed};
    else if (m.schemaKey==='ENEMY_ATTACK' && m.result.hit) effect={type:'hp_change',delta:-m.result.damage};
    else if (m.schemaKey==='CONDITION_ADD') effect={type:'condition',condition:m.result.condition||m.parsed?.Condition};
    if (effect && !narrationMentionsEffect(narration, effect)) {
      const desc = effect.type==='hp_change' ? `${Math.abs(effect.delta)} ${effect.delta<0?'damage':'healing'}` : effect.type==='enemy_damage' ? (effect.killed?`${effect.enemyName} was slain`:`${effect.enemyName} took damage`) : `condition "${effect.condition}" applied`;
      result.missingFiction.push({ schemaKey:m.schemaKey, effect, message:`[SYSTEM: ${desc} was applied but not narrated.]` });
    }
  }
  return result;
}

export default { extractDamageClaims, extractDeathClaims, narrationMentionsEffect, reconcileTurn };
