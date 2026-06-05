import { useState, useEffect, useRef, useCallback } from 'react';
import PartyView from './PartyView';
import DiceRoller from './DiceRoller';
import DMCoachingPanel from './DMCoachingPanel';
import PartyLorePanel from './PartyLorePanel';
import NPCCodexPanel from './NPCCodexPanel';
import PlotThreadPanel from './PlotThreadPanel';
import CampaignPrepScreen from './CampaignPrepScreen';
import PrepReferencePanel from './PrepReferencePanel';
import EquipmentReferencePanel from './EquipmentReferencePanel';
import SpellReferencePanel from './SpellReferencePanel';
import RulesReferencePanel from './RulesReferencePanel';
import EffectTracker from './EffectTracker';
import BondsPanel from './BondsPanel';

const CHAR_COLORS = ['#60a5fa', '#c084fc', '#10b981', '#f59e0b'];

export default function DMMode({ onBack }) {
  // Phase: 'select' | 'prep' | 'gameplay' | 'end'
  const [phase, setPhase] = useState('select');

  // Party management
  const [parties, setParties] = useState([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [selectedParty, setSelectedParty] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [genConfig, setGenConfig] = useState({ setting: 'Forgotten Realms', tone: 'heroic fantasy', level: 3 });

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // { role: 'dm'|'party', content, segments?, pendingRolls? }
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [sessionSummary, setSessionSummary] = useState('');
  const [startingSession, setStartingSession] = useState(false);
  const [openingScene, setOpeningScene] = useState('');

  // Active session detection
  const [activeSession, setActiveSession] = useState(null); // { id, title, messageCount, messages }
  const [checkingActive, setCheckingActive] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [editingSummary, setEditingSummary] = useState(null); // { sessionId, text }

  // Pending dice rolls
  const [pendingRolls, setPendingRolls] = useState([]);

  // Panels
  const [showPartyView, setShowPartyView] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const [showNpcCodex, setShowNpcCodex] = useState(false);
  const [showPlotThreads, setShowPlotThreads] = useState(false);
  const [showPrepRef, setShowPrepRef] = useState(false);
  const [showEquipRef, setShowEquipRef] = useState(false);
  const [showSpellRef, setShowSpellRef] = useState(false);
  const [showRulesRef, setShowRulesRef] = useState(false);
  const [showBonds, setShowBonds] = useState(false);
  const [lastBondShifts, setLastBondShifts] = useState([]);

  // Effect/Duration Tracker
  const [activeEffects, setActiveEffects] = useState([]);
  const [combatRound, setCombatRound] = useState(1);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ============================================================
  // PARTY LIST
  // ============================================================

  const loadParties = useCallback(async () => {
    try {
      const res = await fetch('/api/dm-mode/parties');
      const data = await res.json();
      setParties(data.filter(p => p.status === 'active'));
    } catch (err) {
      console.error('Failed to load parties:', err);
    } finally {
      setLoadingParties(false);
    }
  }, []);

  useEffect(() => { loadParties(); }, [loadParties]);

  // Check for active session and load history when a party is selected
  useEffect(() => {
    if (!selectedParty) {
      setActiveSession(null);
      setSessionHistory([]);
      return;
    }
    let cancelled = false;
    setCheckingActive(true);
    fetch(`/api/dm-mode/active/${selectedParty.id}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setActiveSession(data);
      })
      .catch(() => {
        if (!cancelled) setActiveSession(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingActive(false);
      });
    // Also load session history
    fetch(`/api/dm-mode/history/${selectedParty.id}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setSessionHistory(Array.isArray(data) ? data.filter(s => s.status === 'completed') : []);
      })
      .catch(() => {
        if (!cancelled) setSessionHistory([]);
      });
    return () => { cancelled = true; };
  }, [selectedParty?.id]);

  const handleSaveSummary = async (sessionId, newSummary) => {
    try {
      const res = await fetch(`/api/dm-mode/session/${sessionId}/summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: newSummary })
      });
      if (res.ok) {
        setSessionHistory(prev => prev.map(s =>
          s.id === sessionId ? { ...s, summary: newSummary } : s
        ));
        setEditingSummary(null);
      }
    } catch (err) {
      console.error('Failed to save summary:', err);
    }
  };

  // ============================================================
  // PARTY GENERATION
  // ============================================================

  const handleGenerateParty = async () => {
    setGenerating(true);
    setGenerationError(null);
    try {
      const res = await fetch('/api/dm-mode/generate-party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(genConfig)
      });
      if (!res.ok) {
        let errMsg = 'Generation failed';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }
      const party = await res.json();
      setParties(prev => [party, ...prev]);
      setSelectedParty(party);
      setShowGenerateForm(false);
    } catch (err) {
      setGenerationError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRetireParty = async (partyId) => {
    if (!confirm('Retire this party? This will end any active sessions.')) return;
    try {
      await fetch(`/api/dm-mode/party/${partyId}`, { method: 'DELETE' });
      setParties(prev => prev.filter(p => p.id !== partyId));
      if (selectedParty?.id === partyId) setSelectedParty(null);
    } catch (err) {
      console.error('Failed to retire party:', err);
    }
  };

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  const handleStartSession = async () => {
    if (!selectedParty) return;
    setStartingSession(true);
    setSessionError(null);
    try {
      const res = await fetch('/api/dm-mode/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: selectedParty.id,
          openingScene: openingScene.trim() || undefined
        })
      });

      if (res.status === 409) {
        // Active session exists — refresh active session data and resume
        const activeRes = await fetch(`/api/dm-mode/active/${selectedParty.id}`);
        const activeData = await activeRes.json();
        if (activeData) {
          setActiveSession(activeData);
          setSessionId(activeData.id);
          const displayMessages = (activeData.messages || []).map(m => {
            if (m.role === 'dm') return { role: 'dm', content: m.content };
            const segments = parseSegments(m.content);
            return { role: 'party', content: m.content, segments };
          });
          setMessages(displayMessages.length > 0 ? displayMessages : [{
            role: 'party', content: '*Session resumed.*',
            segments: [{ character: null, content: '*Session resumed.*' }]
          }]);
          setPhase('gameplay');
          setOpeningScene('');
        }
        return;
      }

      if (!res.ok) {
        let errMsg = 'Failed to start session';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      setSessionId(data.sessionId);
      setSelectedParty(prev => ({ ...prev, characters: data.characters, tensions: data.tensions }));

      // Parse the opening narrative into segments
      const segments = parseSegments(data.openingNarrative);
      setMessages([{
        role: 'party',
        content: data.openingNarrative,
        segments
      }]);

      setPhase('gameplay');
      setOpeningScene('');
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setStartingSession(false);
    }
  };

  const handleResumeSession = async () => {
    if (!activeSession) return;
    setStartingSession(true);
    setSessionError(null);
    try {
      // activeSession already has messages from the /active endpoint
      const session = activeSession;
      setSessionId(session.id);

      // Rebuild display messages from stored history
      const displayMessages = (session.messages || []).map(m => {
        if (m.role === 'dm') {
          return { role: 'dm', content: m.content };
        } else {
          const segments = parseSegments(m.content);
          return { role: 'party', content: m.content, segments };
        }
      });

      if (displayMessages.length === 0) {
        displayMessages.push({
          role: 'party',
          content: '*Session resumed. The party awaits your narration.*',
          segments: [{ character: null, content: '*Session resumed. The party awaits your narration.*' }]
        });
      }

      setMessages(displayMessages);
      setPhase('gameplay');
      setOpeningScene('');
    } catch (err) {
      setSessionError('Failed to resume session: ' + err.message);
    } finally {
      setStartingSession(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending || !sessionId) return;

    setSending(true);
    setSessionError(null);
    setInputText('');

    // Detect OOC prefix for display
    const isOOC = /^(?:\(?\s*OOC\s*\)?\s*(?:to\s+)?\w*\s*[:—-])/i.test(text);

    // Add DM message to display
    setMessages(prev => [...prev, { role: 'dm', content: text, ooc: isOOC }]);

    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: text })
      });

      if (!res.ok) {
        let errMsg = 'Failed to send message';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const segments = data.segments || parseSegments(data.narrative);

      // Collect pending rolls
      const newRolls = [];
      if (data.pendingRolls?.skillChecks?.length) {
        data.pendingRolls.skillChecks.forEach(sc =>
          newRolls.push({ type: 'skill_check', character: sc.character, skill: sc.skill, modifier: sc.modifier })
        );
      }
      if (data.pendingRolls?.attacks?.length) {
        data.pendingRolls.attacks.forEach(a =>
          newRolls.push({ type: 'attack', character: a.character, target: a.target, weapon: a.weapon, attackBonus: a.attackBonus })
        );
      }
      if (data.pendingRolls?.spellCasts?.length) {
        data.pendingRolls.spellCasts.forEach(s =>
          newRolls.push({ type: 'spell', character: s.character, spell: s.spell, target: s.target, spellLevel: s.level })
        );
      }

      if (newRolls.length > 0) {
        setPendingRolls(prev => [...prev, ...newRolls]);
        // Auto-open dice roller if there are pending rolls
        setShowDiceRoller(true);
      }

      // Apply bond shifts — update local party state and notify BondsPanel
      if (data.bondShifts?.length > 0 && data.updatedCharacters) {
        setLastBondShifts(data.bondShifts);
        setSelectedParty(prev => prev ? { ...prev, characters: data.updatedCharacters } : prev);
        setShowBonds(true);
      }

      setMessages(prev => [...prev, {
        role: 'party',
        content: data.narrative,
        segments,
        ooc: data.ooc || false
      }]);
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleRollResult = async (rollData) => {
    if (!sessionId) return;

    // Remove the resolved roll from pending
    setPendingRolls(prev => {
      const idx = prev.findIndex(r =>
        r.character === rollData.character && r.type === rollData.rollType
      );
      if (idx >= 0) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      return prev;
    });

    // Add roll result to messages display
    const successText = rollData.success !== undefined
      ? (rollData.success ? ' — Success!' : ' — Failure!')
      : '';
    setMessages(prev => [...prev, {
      role: 'system',
      content: `${rollData.character} rolled ${rollData.result}${rollData.dc ? ` (DC ${rollData.dc})` : ''}${successText}`
    }]);

    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/roll-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rollData)
      });

      if (!res.ok) return;
      const data = await res.json();
      const segments = data.segments || parseSegments(data.narrative);

      setMessages(prev => [...prev, {
        role: 'party',
        content: data.narrative,
        segments
      }]);
    } catch (err) {
      console.error('Roll result error:', err);
    }
  };

  const handleUpdateHp = async (characterName, newHp) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/update-hp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName, newHp })
      });
      if (res.ok) {
        const data = await res.json();
        // Update local party data
        setSelectedParty(prev => {
          if (!prev) return prev;
          const chars = prev.characters.map(c =>
            c.name === characterName ? { ...c, current_hp: data.current_hp } : c
          );
          return { ...prev, characters: chars };
        });
      }
    } catch (err) {
      console.error('HP update error:', err);
    }
  };

  const handleAwardXp = async (amount, characterName = null) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/award-xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, characterName, splitEvenly: !characterName })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedParty(prev => {
          if (!prev) return prev;
          const chars = prev.characters.map(c => {
            const updated = data.characters.find(u => u.name === c.name);
            return updated ? { ...c, xp: updated.xp } : c;
          });
          return { ...prev, characters: chars };
        });
      }
    } catch (err) {
      console.error('XP award error:', err);
    }
  };

  const handleAwardLoot = async (characterName, items, gold) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/award-loot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName, items: items || [], gold: gold || 0 })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedParty(prev => {
          if (!prev) return prev;
          const chars = prev.characters.map(c =>
            c.name === characterName ? { ...c, inventory: data.inventory, gold_gp: data.gold_gp } : c
          );
          return { ...prev, characters: chars };
        });
      }
    } catch (err) {
      console.error('Loot award error:', err);
    }
  };

  const handleLevelUp = async (characterName, hpIncrease) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/level-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName, hpIncrease })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedParty(prev => {
          if (!prev) return prev;
          const chars = prev.characters.map(c =>
            c.name === characterName ? { ...c, level: data.newLevel, max_hp: data.max_hp, current_hp: data.current_hp, xp: data.xp } : c
          );
          return { ...prev, characters: chars };
        });
      }
    } catch (err) {
      console.error('Level up error:', err);
    }
  };

  const handleUpdateSpellSlot = async (characterName, level, newUsed) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/update-spell-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterName, level, used: Math.max(0, newUsed) })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedParty(prev => {
          if (!prev) return prev;
          const chars = prev.characters.map(c =>
            c.name === characterName ? { ...c, spell_slots_used: data.spell_slots_used } : c
          );
          return { ...prev, characters: chars };
        });
      }
    } catch (err) {
      console.error('Spell slot update error:', err);
    }
  };

  const handleLongRest = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/long-rest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedParty(prev => prev ? { ...prev, characters: data.characters } : prev);
      }
    } catch (err) {
      console.error('Long rest error:', err);
    }
  };

  const handleRelationshipUpdate = async (fromCharacter, toCharacter, warmthDelta, trustDelta, note) => {
    if (!selectedParty) return;
    try {
      const res = await fetch(`/api/dm-mode/party/${selectedParty.id}/relationship`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromCharacter, toCharacter, warmthDelta, trustDelta, note })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedParty(prev => prev ? { ...prev, characters: data.characters } : prev);
      }
    } catch (err) {
      console.error('Relationship update error:', err);
    }
  };

  const handleGameDayChange = async (delta) => {
    if (!selectedParty) return;
    try {
      const res = await fetch(`/api/dm-mode/party/${selectedParty.id}/game-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedParty(prev => prev ? { ...prev, current_game_day: data.current_game_day } : prev);
      }
    } catch (err) {
      console.error('Game day update error:', err);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    if (!confirm('End this session? A summary will be generated.')) return;

    setSending(true);
    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setSessionSummary(data.summary || 'Session ended.');
      setPhase('end');
    } catch (err) {
      setSessionError('Failed to end session: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================

  function parseSegments(text) {
    if (!text) return [];
    const segments = [];
    const lines = text.split('\n');
    let currentChar = null;
    let currentContent = [];

    for (const line of lines) {
      const charMatch = line.match(/^\*\*([^*]+?)(?::\*\*|\*\*:?)\s*(.*)/);
      if (charMatch) {
        if (currentChar !== null) {
          segments.push({ character: currentChar, content: currentContent.join('\n').trim() });
        }
        currentChar = charMatch[1].trim();
        const rest = charMatch[2]?.trim() || '';
        currentContent = rest ? [rest] : [];
      } else if (currentChar !== null) {
        currentContent.push(line);
      } else if (line.trim()) {
        segments.push({ character: null, content: line.trim() });
      }
    }
    if (currentChar !== null) {
      segments.push({ character: currentChar, content: currentContent.join('\n').trim() });
    }
    if (segments.length === 0 && text.trim()) {
      return [{ character: null, content: text.trim() }];
    }
    return segments;
  }

  function getCharColor(charName) {
    if (!selectedParty?.characters) return '#aaa';
    const idx = selectedParty.characters.findIndex(c => c.name === charName);
    return idx >= 0 ? (selectedParty.characters[idx].color || CHAR_COLORS[idx]) : '#aaa';
  }

  function getCharacterColorMap() {
    if (!selectedParty?.characters) return {};
    const map = {};
    selectedParty.characters.forEach((c, i) => {
      map[c.name] = c.color || CHAR_COLORS[i];
    });
    return map;
  }

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after sending
  useEffect(() => {
    if (!sending && phase === 'gameplay') {
      inputRef.current?.focus();
    }
  }, [sending, phase]);

  // Panel mutual exclusion
  const openPanel = (panel) => {
    setShowPartyView(panel === 'party');
    setShowDiceRoller(panel === 'dice');
    setShowCoaching(panel === 'coaching');
    setShowLore(panel === 'lore');
    setShowNpcCodex(panel === 'npcs');
    setShowPlotThreads(panel === 'threads');
    setShowPrepRef(panel === 'prep');
    setShowEquipRef(panel === 'equip');
    setShowSpellRef(panel === 'spells');
    setShowRulesRef(panel === 'rules');
    setShowBonds(panel === 'bonds');
  };

  // ============================================================
  // EFFECT TRACKER HANDLERS
  // ============================================================

  const handleAddEffect = (effect) => {
    // Concentration check: only one concentration per caster
    if (effect.concentration && effect.casterName) {
      const existing = activeEffects.find(e => e.concentration && e.casterName === effect.casterName);
      if (existing) {
        if (!confirm(`${effect.casterName} is already concentrating on "${existing.name}". Drop it to concentrate on "${effect.name}"?`)) {
          return;
        }
        setActiveEffects(prev => prev.filter(e => e.id !== existing.id));
      }
    }
    setActiveEffects(prev => [...prev, { ...effect, id: Date.now() + Math.random() }]);
  };

  const handleRemoveEffect = (effectId) => {
    setActiveEffects(prev => prev.filter(e => e.id !== effectId));
  };

  const handleAdvanceRound = () => {
    setCombatRound(prev => prev + 1);
    setActiveEffects(prev =>
      prev
        .map(e => e.roundsRemaining === null ? e : { ...e, roundsRemaining: e.roundsRemaining - 1 })
        .filter(e => e.roundsRemaining === null || e.roundsRemaining > 0)
    );
  };

  // ============================================================
  // RENDER: PARTY SELECT PHASE
  // ============================================================

  if (phase === 'select') {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
        <h2 style={{ color: '#e67e22', marginBottom: '0.5rem' }}>DM Mode</h2>
        <p style={{ color: '#999', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          You are the Dungeon Master. Generate a party of 4 AI-controlled player characters and run your campaign.
        </p>

        {/* Generate New Party */}
        {!showGenerateForm ? (
          <button
            onClick={() => setShowGenerateForm(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(230, 126, 34, 0.3), rgba(211, 84, 0, 0.2))',
              border: '1px solid rgba(230, 126, 34, 0.5)',
              borderRadius: '8px',
              color: '#e67e22',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              marginBottom: '1.5rem',
              width: '100%'
            }}
          >
            + Generate New Party
          </button>
        ) : (
          <div style={{
            padding: '1.25rem',
            background: 'rgba(230, 126, 34, 0.08)',
            border: '1px solid rgba(230, 126, 34, 0.3)',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#e67e22', margin: '0 0 1rem' }}>Generate New Party</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Setting</label>
                <select
                  value={genConfig.setting}
                  onChange={e => setGenConfig(prev => ({ ...prev, setting: e.target.value }))}
                  style={{
                    width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff'
                  }}
                >
                  <option value="Forgotten Realms">Forgotten Realms</option>
                  <option value="Eberron">Eberron</option>
                  <option value="Greyhawk">Greyhawk</option>
                  <option value="Ravenloft">Ravenloft</option>
                  <option value="Custom">Custom Setting</option>
                </select>
              </div>

              <div>
                <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Tone</label>
                <select
                  value={genConfig.tone}
                  onChange={e => setGenConfig(prev => ({ ...prev, tone: e.target.value }))}
                  style={{
                    width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff'
                  }}
                >
                  <option value="heroic fantasy">Heroic Fantasy</option>
                  <option value="dark and gritty">Dark & Gritty</option>
                  <option value="lighthearted adventure">Lighthearted Adventure</option>
                  <option value="political intrigue">Political Intrigue</option>
                  <option value="horror">Horror</option>
                </select>
              </div>

              <div>
                <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Starting Level</label>
                <select
                  value={genConfig.level}
                  onChange={e => setGenConfig(prev => ({ ...prev, level: parseInt(e.target.value) }))}
                  style={{
                    width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', color: '#fff'
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => (
                    <option key={l} value={l}>Level {l}</option>
                  ))}
                </select>
              </div>
            </div>

            {generationError && (
              <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {generationError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleGenerateParty}
                disabled={generating}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: generating ? 'rgba(255,255,255,0.1)' : '#e67e22',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: generating ? 'wait' : 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
              >
                {generating ? 'Generating with Opus...' : 'Generate Party'}
              </button>
              <button
                onClick={() => setShowGenerateForm(false)}
                disabled={generating}
                style={{
                  padding: '0.6rem 1rem',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#999',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>

            {generating && (
              <div style={{ marginTop: '1rem', color: '#e67e22', fontSize: '0.85rem' }}>
                Opus is crafting 4 unique characters with interlocking backstories and genuine tensions. This takes about 30-60 seconds...
              </div>
            )}
          </div>
        )}

        {/* Existing Parties */}
        {loadingParties ? (
          <div style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>Loading parties...</div>
        ) : parties.length === 0 && !showGenerateForm ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>
            No parties yet. Generate your first party above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {parties.map(party => (
              <PartyCard
                key={party.id}
                party={party}
                isSelected={selectedParty?.id === party.id}
                onSelect={() => setSelectedParty(selectedParty?.id === party.id ? null : party)}
                onRetire={() => handleRetireParty(party.id)}
              />
            ))}
          </div>
        )}

        {/* Continue or Start Session */}
        {selectedParty && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            background: activeSession
              ? 'rgba(52, 152, 219, 0.08)'
              : 'rgba(46, 204, 113, 0.08)',
            border: `1px solid ${activeSession ? 'rgba(52, 152, 219, 0.3)' : 'rgba(46, 204, 113, 0.3)'}`,
            borderRadius: '8px'
          }}>
            {checkingActive ? (
              <div style={{ color: '#999', fontSize: '0.85rem' }}>Checking for active session...</div>
            ) : activeSession ? (
              <>
                <h3 style={{ color: '#3498db', margin: '0 0 0.5rem' }}>
                  Active Session: {activeSession.title}
                </h3>
                <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                  {activeSession.messageCount} exchange{activeSession.messageCount !== 1 ? 's' : ''} so far
                </p>

                {sessionError && (
                  <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{sessionError}</div>
                )}

                <button
                  onClick={handleResumeSession}
                  disabled={startingSession}
                  style={{
                    padding: '0.75rem 2rem',
                    background: startingSession ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #3498db, #2980b9)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: startingSession ? 'wait' : 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}
                >
                  {startingSession ? 'Loading...' : 'Continue Session'}
                </button>
              </>
            ) : (
              <>
                <h3 style={{ color: '#2ecc71', margin: '0 0 0.75rem' }}>
                  Start Session with {selectedParty.name}
                </h3>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>
                    Opening Scene (optional — leave blank for character introductions)
                  </label>
                  <textarea
                    value={openingScene}
                    onChange={e => setOpeningScene(e.target.value)}
                    placeholder="e.g., You stand at the gates of a crumbling fortress. Rain pelts your cloaks as lightning illuminates the dark towers above..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px',
                      color: '#fff',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {sessionError && (
                  <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{sessionError}</div>
                )}

                <button
                  onClick={handleStartSession}
                  disabled={startingSession}
                  style={{
                    padding: '0.75rem 2rem',
                    background: startingSession ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #2ecc71, #27ae60)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: startingSession ? 'wait' : 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}
                >
                  {startingSession ? 'Starting...' : 'Begin Session'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Campaign Prep Button */}
        {selectedParty && (
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => setPhase('prep')}
              style={{
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.08))',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '8px',
                color: '#10b981',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem',
                width: '100%'
              }}
            >
              Campaign Prep
            </button>
          </div>
        )}

        {/* Session Persistence Reference */}
        {selectedParty && sessionHistory.length > 0 && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem 1.25rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px'
          }}>
            <h4 style={{ color: '#e67e22', margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              Session Memory Guide
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <h5 style={{ color: '#2ecc71', margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: '600' }}>Character Data (Always)</h5>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#aaa', fontSize: '0.78rem', lineHeight: '1.6' }}>
                  <li>Stats (HP, AC, level, XP)</li>
                  <li>Inventory, gold, and equipment</li>
                  <li>Ability scores and proficiencies</li>
                  <li>Spells and spell slots</li>
                  <li>Personality, secrets, and bonds</li>
                  <li>Party relationships and tensions</li>
                </ul>
              </div>
              <div>
                <h5 style={{ color: '#2ecc71', margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: '600' }}>Extracted Each Session (Auto)</h5>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#aaa', fontSize: '0.78rem', lineHeight: '1.6' }}>
                  <li>NPC names, roles, and descriptions</li>
                  <li>Locations visited and events</li>
                  <li>Active and resolved plot threads</li>
                  <li>Key decisions and consequences</li>
                  <li>Character development moments</li>
                  <li>Combat encounters and outcomes</li>
                </ul>
              </div>
            </div>
            <p style={{ color: '#888', fontSize: '0.75rem', margin: '0.6rem 0 0', fontStyle: 'italic' }}>
              The AI automatically extracts structured memory from each session. NPCs, plot threads, locations, and character moments are tracked across your entire campaign history.
            </p>
          </div>
        )}

        {/* Session History */}
        {selectedParty && sessionHistory.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ color: '#aaa', margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: '600' }}>
              Past Sessions ({sessionHistory.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sessionHistory.map(session => (
                <div key={session.id} style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ color: '#e67e22', fontWeight: '600', fontSize: '0.9rem' }}>
                        {session.title || `Session ${session.id}`}
                      </span>
                      {session.end_time && (
                        <span style={{ color: '#666', fontSize: '0.75rem', marginLeft: '0.75rem' }}>
                          {new Date(session.end_time).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {editingSummary?.sessionId !== session.id && (
                      <button
                        onClick={() => setEditingSummary({ sessionId: session.id, text: session.summary || '' })}
                        style={{
                          padding: '0.25rem 0.6rem',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '4px',
                          color: '#999',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          flexShrink: 0
                        }}
                      >
                        Edit Summary
                      </button>
                    )}
                  </div>

                  {editingSummary?.sessionId === session.id ? (
                    <div>
                      <textarea
                        value={editingSummary.text}
                        onChange={e => setEditingSummary(prev => ({ ...prev, text: e.target.value }))}
                        rows={5}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(230, 126, 34, 0.4)',
                          borderRadius: '6px',
                          color: '#ddd',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          fontSize: '0.85rem',
                          boxSizing: 'border-box',
                          lineHeight: '1.5'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => handleSaveSummary(session.id, editingSummary.text)}
                          style={{
                            padding: '0.35rem 1rem',
                            background: '#e67e22',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSummary(null)}
                          style={{
                            padding: '0.35rem 1rem',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            color: '#999',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{
                      color: session.summary ? '#bbb' : '#666',
                      fontSize: '0.85rem',
                      margin: 0,
                      lineHeight: '1.5',
                      fontStyle: session.summary ? 'normal' : 'italic',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {session.summary || 'No summary yet — click Edit Summary to add one.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: SESSION END PHASE
  // ============================================================

  if (phase === 'end') {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#e67e22', marginBottom: '1rem' }}>Session Complete</h2>

        {selectedParty && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {selectedParty.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              {selectedParty.characters?.map((c, i) => (
                <div key={c.name} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: `${c.color || CHAR_COLORS[i]}33`,
                    border: `2px solid ${c.color || CHAR_COLORS[i]}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: c.color || CHAR_COLORS[i], fontWeight: 'bold', fontSize: '1.1rem',
                    margin: '0 auto 0.3rem'
                  }}>
                    {c.name[0]}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: c.color || CHAR_COLORS[i] }}>{c.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{
          padding: '1.25rem',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(230, 126, 34, 0.3)',
          borderRadius: '8px',
          textAlign: 'left',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ color: '#e67e22', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Session Summary</h3>
          <p style={{ color: '#ccc', lineHeight: '1.6', margin: 0 }}>{sessionSummary}</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => {
              setPhase('select');
              setSessionId(null);
              setMessages([]);
              setPendingRolls([]);
              setSessionSummary('');
              setActiveEffects([]);
              setCombatRound(1);
              loadParties();
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#e67e22',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Back to Parties
          </button>
          <button
            onClick={onBack}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: '#999',
              cursor: 'pointer'
            }}
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: PREP PHASE
  // ============================================================

  if (phase === 'prep') {
    return (
      <CampaignPrepScreen
        party={selectedParty}
        onBack={() => setPhase('select')}
      />
    );
  }

  // ============================================================
  // RENDER: GAMEPLAY PHASE
  // ============================================================

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', position: 'relative' }}>
      {/* Top Bar: Party Status + Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.2)',
        flexShrink: 0
      }}>
        {/* Party mini-cards */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {selectedParty?.characters?.map((char, i) => {
            const color = char.color || CHAR_COLORS[i];
            const hpPct = char.max_hp > 0 ? (char.current_hp / char.max_hp) * 100 : 100;
            const hpColor = hpPct > 50 ? '#2ecc71' : hpPct > 25 ? '#f39c12' : '#e74c3c';
            return (
              <div
                key={char.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  background: `${color}11`,
                  border: `1px solid ${color}44`,
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
                onClick={() => openPanel('party')}
                title={`${char.name} — ${char.race} ${char.class} Lvl ${char.level}`}
              >
                <span style={{ color, fontWeight: 'bold' }}>{char.name.split(' ')[0]}</span>
                <span style={{ color: hpColor, fontSize: '0.75rem' }}>
                  {char.current_hp}/{char.max_hp}
                </span>
                <span style={{ color: '#6ea8fe', fontSize: '0.7rem' }}>AC{char.armor_class}</span>
              </div>
            );
          })}
        </div>

        {/* Game Day Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 0.5rem' }}>
          <button
            onClick={() => handleGameDayChange(-1)}
            style={{
              width: '20px', height: '20px', borderRadius: '3px', border: '1px solid rgba(212,175,55,0.3)',
              background: 'transparent', color: '#d4af37', cursor: 'pointer', fontSize: '0.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
            }}
          >-</button>
          <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.8rem', minWidth: '3.5rem', textAlign: 'center' }}>
            Day {selectedParty?.current_game_day || 1}
          </span>
          <button
            onClick={() => handleGameDayChange(1)}
            style={{
              width: '20px', height: '20px', borderRadius: '3px', border: '1px solid rgba(212,175,55,0.3)',
              background: 'transparent', color: '#d4af37', cursor: 'pointer', fontSize: '0.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
            }}
          >+</button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ToolbarButton
            label="Party"
            active={showPartyView}
            onClick={() => openPanel(showPartyView ? null : 'party')}
            color="#f97316"
          />
          <ToolbarButton
            label="Dice"
            active={showDiceRoller}
            onClick={() => openPanel(showDiceRoller ? null : 'dice')}
            color="#8b5cf6"
            badge={pendingRolls.length || null}
          />
          <ToolbarButton
            label="Coach"
            active={showCoaching}
            onClick={() => openPanel(showCoaching ? null : 'coaching')}
            color="#14b8a6"
          />
          <ToolbarButton
            label="Lore"
            active={showLore}
            onClick={() => openPanel(showLore ? null : 'lore')}
            color="#a855f7"
          />
          <ToolbarButton
            label="NPCs"
            active={showNpcCodex}
            onClick={() => openPanel(showNpcCodex ? null : 'npcs')}
            color="#e74c3c"
          />
          <ToolbarButton
            label="Quests"
            active={showPlotThreads}
            onClick={() => openPanel(showPlotThreads ? null : 'threads')}
            color="#3b82f6"
          />
          <ToolbarButton
            label="Prep"
            active={showPrepRef}
            onClick={() => openPanel(showPrepRef ? null : 'prep')}
            color="#10b981"
          />
          <ToolbarButton
            label="Equip"
            active={showEquipRef}
            onClick={() => openPanel(showEquipRef ? null : 'equip')}
            color="#d4af37"
          />
          <ToolbarButton
            label="Spells"
            active={showSpellRef}
            onClick={() => openPanel(showSpellRef ? null : 'spells')}
            color="#6366f1"
          />
          <ToolbarButton
            label="Rules"
            active={showRulesRef}
            onClick={() => openPanel(showRulesRef ? null : 'rules')}
            color="#f59e0b"
          />
          <ToolbarButton
            label="Bonds"
            active={showBonds}
            onClick={() => openPanel(showBonds ? null : 'bonds')}
            color="#e11d48"
            badge={lastBondShifts.length > 0 && !showBonds ? lastBondShifts.length : null}
          />
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.15)', margin: '0 0.25rem' }} />
          <button
            onClick={handleEndSession}
            style={{
              padding: '0.3rem 0.7rem',
              background: 'transparent',
              border: '1px solid rgba(231, 76, 60, 0.4)',
              borderRadius: '4px',
              color: '#e74c3c',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            End Session
          </button>
        </div>
      </div>

      {/* Effect/Duration Tracker */}
      <EffectTracker
        effects={activeEffects}
        characters={selectedParty?.characters?.map(c => c.name) || []}
        onAddEffect={handleAddEffect}
        onRemoveEffect={handleRemoveEffect}
        onAdvanceRound={handleAdvanceRound}
        roundNumber={combatRound}
      />

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {messages.map((msg, idx) => {
          if (msg.role === 'dm') {
            const dmOOC = msg.ooc;
            return (
              <div key={idx} style={{
                alignSelf: 'flex-end',
                maxWidth: '80%',
                padding: '0.75rem 1rem',
                background: dmOOC ? 'rgba(139, 92, 246, 0.12)' : 'rgba(230, 126, 34, 0.15)',
                borderRadius: '12px 12px 2px 12px',
                border: `1px solid ${dmOOC ? 'rgba(139, 92, 246, 0.35)' : 'rgba(230, 126, 34, 0.3)'}`,
                color: '#eee'
              }}>
                <div style={{ fontSize: '0.7rem', color: dmOOC ? '#a78bfa' : '#e67e22', marginBottom: '0.3rem', fontWeight: 'bold' }}>
                  {dmOOC ? 'DM (OOC)' : 'DM (You)'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{msg.content}</div>
              </div>
            );
          }

          if (msg.role === 'system') {
            return (
              <div key={idx} style={{
                alignSelf: 'center',
                padding: '0.4rem 1rem',
                background: 'rgba(139, 92, 246, 0.15)',
                borderRadius: '20px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#a78bfa',
                fontSize: '0.8rem',
                textAlign: 'center'
              }}>
                {msg.content}
              </div>
            );
          }

          // Party message — render character segments
          const partyOOC = msg.ooc;
          return (
            <div key={idx} style={{
              alignSelf: 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              ...(partyOOC ? {
                padding: '0.5rem',
                background: 'rgba(139, 92, 246, 0.06)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '8px'
              } : {})
            }}>
              {partyOOC && (
                <div style={{ fontSize: '0.65rem', color: '#a78bfa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.25rem' }}>
                  Out of Character
                </div>
              )}
              {(msg.segments || []).map((seg, si) => {
                if (!seg.character) {
                  // Narration (no character label)
                  return (
                    <div key={si} style={{
                      padding: '0.5rem 0.75rem',
                      color: partyOOC ? '#c4b5fd' : '#bbb',
                      fontStyle: 'italic',
                      fontSize: '0.9rem',
                      lineHeight: '1.5'
                    }}>
                      {seg.content}
                    </div>
                  );
                }
                const color = partyOOC ? '#a78bfa' : getCharColor(seg.character);
                return (
                  <div key={si} style={{
                    padding: '0.6rem 0.75rem',
                    borderLeft: `3px solid ${color}`,
                    background: partyOOC ? 'rgba(139, 92, 246, 0.08)' : `${color}0a`,
                    borderRadius: '0 8px 8px 0'
                  }}>
                    <div style={{ color, fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                      {seg.character}
                    </div>
                    <div style={{ color: partyOOC ? '#d4c8f0' : '#ddd', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.9rem' }}>
                      {seg.content}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {sending && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '0.75rem 1rem',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            color: '#888',
            fontStyle: 'italic',
            fontSize: '0.85rem'
          }}>
            The party is responding...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {sessionError && (
        <div style={{
          padding: '0.5rem 1rem',
          background: 'rgba(231, 76, 60, 0.15)',
          borderTop: '1px solid rgba(231, 76, 60, 0.3)',
          color: '#e74c3c',
          fontSize: '0.85rem'
        }}>
          {sessionError}
          <button
            onClick={() => setSessionError(null)}
            style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}
          >
            dismiss
          </button>
        </div>
      )}

      {/* Input Area */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.2)',
        display: 'flex',
        gap: '0.75rem',
        flexShrink: 0
      }}>
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Describe what happens... (Shift+Enter for new line)"
          rows={2}
          disabled={sending}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            color: '#fff',
            resize: 'none',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={sending || !inputText.trim()}
          style={{
            padding: '0 1.5rem',
            background: sending || !inputText.trim() ? 'rgba(255,255,255,0.1)' : '#e67e22',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: sending || !inputText.trim() ? 'default' : 'pointer',
            fontWeight: '600',
            alignSelf: 'stretch'
          }}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>

      {/* Slide-in Panels */}
      {showPartyView && selectedParty && (
        <PartyView
          party={selectedParty}
          onClose={() => setShowPartyView(false)}
          onUpdateHp={handleUpdateHp}
          onAwardXp={handleAwardXp}
          onAwardLoot={handleAwardLoot}
          onLevelUp={handleLevelUp}
          onUpdateSpellSlot={handleUpdateSpellSlot}
          onLongRest={handleLongRest}
          sessionId={sessionId}
        />
      )}
      {showDiceRoller && (
        <DiceRoller
          pendingRolls={pendingRolls}
          onRollResult={handleRollResult}
          onClose={() => setShowDiceRoller(false)}
          characterColors={getCharacterColorMap()}
        />
      )}
      {showCoaching && sessionId && (
        <DMCoachingPanel
          sessionId={sessionId}
          onClose={() => setShowCoaching(false)}
        />
      )}
      {showLore && selectedParty && (
        <PartyLorePanel
          party={selectedParty}
          onClose={() => setShowLore(false)}
        />
      )}
      {showNpcCodex && selectedParty && (
        <NPCCodexPanel
          partyId={selectedParty.id}
          onClose={() => setShowNpcCodex(false)}
        />
      )}
      {showPlotThreads && selectedParty && (
        <PlotThreadPanel
          partyId={selectedParty.id}
          onClose={() => setShowPlotThreads(false)}
        />
      )}
      {showPrepRef && selectedParty && (
        <PrepReferencePanel
          partyId={selectedParty.id}
          onClose={() => setShowPrepRef(false)}
        />
      )}
      {showEquipRef && (
        <EquipmentReferencePanel onClose={() => setShowEquipRef(false)} />
      )}
      {showSpellRef && (
        <SpellReferencePanel onClose={() => setShowSpellRef(false)} />
      )}
      {showRulesRef && (
        <RulesReferencePanel onClose={() => setShowRulesRef(false)} />
      )}
      {showBonds && selectedParty && (
        <BondsPanel
          party={selectedParty}
          partyId={selectedParty.id}
          lastShifts={lastBondShifts}
          onRelationshipUpdate={handleRelationshipUpdate}
          onClose={() => setShowBonds(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function ToolbarButton({ label, active, onClick, color, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.3rem 0.7rem',
        background: active ? `${color}22` : 'transparent',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.15)'}`,
        borderRadius: '4px',
        color: active ? color : '#aaa',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: active ? 'bold' : 'normal',
        position: 'relative'
      }}
    >
      {label}
      {badge && (
        <span style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          background: '#e74c3c',
          color: '#fff',
          borderRadius: '50%',
          width: '16px',
          height: '16px',
          fontSize: '0.65rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold'
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function PartyCard({ party, isSelected, onSelect, onRetire }) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '1rem',
        background: isSelected ? 'rgba(230, 126, 34, 0.1)' : 'rgba(255, 255, 255, 0.03)',
        border: `1px solid ${isSelected ? 'rgba(230, 126, 34, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ color: isSelected ? '#e67e22' : '#ddd', margin: '0 0 0.25rem', fontSize: '1.1rem' }}>
            {party.name}
          </h3>
          <div style={{ color: '#888', fontSize: '0.8rem' }}>
            {party.setting} | {party.tone} | Level {party.level}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRetire(); }}
          style={{
            background: 'transparent',
            border: '1px solid rgba(231, 76, 60, 0.3)',
            borderRadius: '4px',
            color: '#e74c3c',
            cursor: 'pointer',
            fontSize: '0.7rem',
            padding: '0.2rem 0.5rem'
          }}
        >
          Retire
        </button>
      </div>

      {/* Character row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
        {party.characters?.map((char, i) => {
          const color = char.color || CHAR_COLORS[i];
          return (
            <div key={char.name} style={{
              flex: 1,
              padding: '0.5rem',
              background: `${color}0a`,
              borderLeft: `3px solid ${color}`,
              borderRadius: '0 4px 4px 0'
            }}>
              <div style={{ color, fontWeight: 'bold', fontSize: '0.85rem' }}>
                {char.name}
              </div>
              <div style={{ color: '#999', fontSize: '0.75rem' }}>
                {char.race} {char.class}
              </div>
              <div style={{ color: '#777', fontSize: '0.7rem' }}>
                {char.alignment}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tensions preview */}
      {isSelected && party.tensions?.length > 0 && (
        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
          <div style={{ color: '#e67e22', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>
            Party Tensions
          </div>
          {party.tensions.map((t, i) => (
            <div key={i} style={{ color: '#aaa', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
