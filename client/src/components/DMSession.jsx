import { useState, useEffect, useRef } from 'react';
import {
  STARTING_LOCATIONS,
  ERAS,
  ARRIVAL_HOOKS,
  CAMPAIGN_LENGTHS
} from '../data/forgottenRealms';
import { getCampaignModule } from '../data/campaignModules';
import { SEASON_ICONS } from '../data/harptos';
import InventoryPanel from './InventoryPanel';
import CombatTracker from './CombatTracker';
import SessionCockpit from './SessionCockpit.jsx';
import SessionSetup from './SessionSetup';
import SessionRewards from './SessionRewards';
import CampaignNotesPanel from './CampaignNotesPanel';
import QuickReferencePanel from './QuickReferencePanel';
import CompanionsPanel from './CompanionsPanel';
import ConditionPanel from './ConditionPanel';
import { CONDITIONS, getConditionsToClear, reduceExhaustion } from '../data/conditions';

// Default model for D&D sessions (used when Ollama is the provider)
const DEFAULT_MODEL = 'gpt-oss:20b';

export default function DMSession({ character, allCharacters, onBack, onCharacterUpdated }) {
  const [llmStatus, setLlmStatus] = useState(null);
  const [providerPreference, setProviderPreference] = useState('auto'); // 'auto' | 'claude' | 'ollama'
  // Sonnet vs Opus selector. Opus is the production default (v1.0.99 — see
  // DECISION_LOG "Opus as production default for main DM session continuations").
  // The toggle is now an opt-down to Sonnet. Persisted in localStorage as
  // `dndUseSonnet` so the choice survives reload.
  const [useSonnet, setUseSonnet] = useState(() => {
    try { return localStorage.getItem('dndUseSonnet') === '1'; } catch { return false; }
  });
  const updateUseSonnet = (next) => {
    setUseSonnet(next);
    try { localStorage.setItem('dndUseSonnet', next ? '1' : '0'); } catch {}
  };

  // Campaign module selection
  const [selectedModule, setSelectedModule] = useState('custom');

  // New session setup state
  const [startingLocation, setStartingLocation] = useState('');
  const [era, setEra] = useState('');
  const [arrivalHook, setArrivalHook] = useState('');
  const [customArrivalHook, setCustomArrivalHook] = useState('');
  const [customConcepts, setCustomConcepts] = useState('');
  const [campaignLength, setCampaignLength] = useState('ongoing-saga');

  // Second player character (optional)
  const [secondCharacterId, setSecondCharacterId] = useState(null);
  const secondCharacter = secondCharacterId
    ? allCharacters?.find(c => c.id === secondCharacterId)
    : null;

  // Custom NPCs for campaign
  const [availableNpcs, setAvailableNpcs] = useState([]);
  const [selectedNpcIds, setSelectedNpcIds] = useState([]);

  const [activeSession, setActiveSession] = useState(null);
  const [activeGameTab, setActiveGameTab] = useState('adventure');
  const [messages, setMessages] = useState([]);
  const [inputAction, setInputAction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Rewards state
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionRewards, setSessionRewards] = useState(null);
  const [sessionSummary, setSessionSummary] = useState('');
  const [hpChange, setHpChange] = useState(0);
  const [inventoryChanges, setInventoryChanges] = useState(null);
  const [inventoryApplied, setInventoryApplied] = useState(false);
  const [preInventorySnapshot, setPreInventorySnapshot] = useState(null);
  const [extractedNpcs, setExtractedNpcs] = useState([]);

  const [sessionHistory, setSessionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Campaign continuity state
  const [campaignContext, setCampaignContext] = useState(null);
  const [continueCampaign, setContinueCampaign] = useState(false);

  // Campaign notes state
  const [showCampaignNotes, setShowCampaignNotes] = useState(false);
  const [campaignNotes, setCampaignNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesGenerating, setNotesGenerating] = useState(false);
  const [notesTab, setNotesTab] = useState('history'); // 'history', 'memory', 'mynotes'
  const [myNotes, setMyNotes] = useState(''); // Just the editable My Notes section
  const [characterMemories, setCharacterMemories] = useState(''); // AI-observed personality traits

  // Quick reference panel state (view character info without leaving game)
  const [showQuickRef, setShowQuickRef] = useState(false);

  // Companions quick reference panel state
  const [showCompanionsRef, setShowCompanionsRef] = useState(false);
  const [companions, setCompanions] = useState([]);

  // Game date and spell slots state
  const [gameDate, setGameDate] = useState(null);
  const [sessionRecap, setSessionRecap] = useState(null);
  const [spellSlots, setSpellSlots] = useState({ max: {}, used: {} });

  // Recruitment state
  const [pendingRecruitment, setPendingRecruitment] = useState(null);
  const [recruitmentLoading, setRecruitmentLoading] = useState(false);

  // Inventory panel state
  const [showInventory, setShowInventory] = useState(false);
  const [itemsGainedThisSession, setItemsGainedThisSession] = useState([]);

  // Combat tracker state
  const [combatState, setCombatState] = useState(null);

  // Scene descriptor for the cockpit "This scene" panel (from [SCENE] markers)
  const [sceneState, setSceneState] = useState(null);
  const parseSceneTag = (text) => {
    const m = (text || '').match(/\[SCENE:\s*([^\]]+)\]/i);
    if (!m) return null;
    const sc = {};
    m[1].split(';').forEach(p => { const e = p.indexOf('='); if (e > 0) { const k = p.slice(0, e).trim().toLowerCase(); const v = p.slice(e + 1).trim(); if (k && v) sc[k] = v; } });
    return Object.keys(sc).length ? sc : null;
  };

  // Condition tracking state
  const [playerConditions, setPlayerConditions] = useState([]);
  const [companionConditions, setCompanionConditions] = useState({});
  const [showConditionPanel, setShowConditionPanel] = useState(false);

  // Phase B mechanical-spine state: persisted spell effects + concentration,
  // and the DM's pending roll request (preloaded with the player's modifier).
  const [spellEffects, setSpellEffects] = useState([]);
  const [rollRequest, setRollRequest] = useState(null);

  // Hydrate persisted mechanical state when a session loads/resumes so the
  // cockpit reflects active effects, the last scene, and conditions across
  // reloads (previously all ephemeral client state).
  useEffect(() => {
    if (!activeSession) return;
    let cfg = {};
    try { cfg = typeof activeSession.session_config === 'string' ? JSON.parse(activeSession.session_config) : (activeSession.session_config || {}); } catch { cfg = {}; }
    if (Array.isArray(cfg.activeEffects)) setSpellEffects(cfg.activeEffects);
    if (cfg.lastScene) setSceneState(prev => prev || cfg.lastScene);
    let debuffs = [];
    try { debuffs = typeof character?.debuffs === 'string' ? JSON.parse(character.debuffs) : (character?.debuffs || []); } catch { debuffs = []; }
    if (Array.isArray(debuffs) && debuffs.length > 0) setPlayerConditions(prev => prev.length ? prev : debuffs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  const messagesEndRef = useRef(null);

  // Check LLM status on mount
  useEffect(() => {
    checkLLMStatus();
    fetchSessionHistory();
    checkForActiveSession();
    fetchAvailableNpcs();
    fetchCampaignContext();
    fetchCompanions();
  }, [character.id]);

  const fetchCompanions = async () => {
    try {
      const response = await fetch(`/api/companion/character/${character.id}`);
      if (response.ok) {
        const data = await response.json();
        setCompanions(data);
      }
    } catch (error) {
      console.error('Error fetching companions:', error);
    }
  };

  // Companion activities (away/send-activity/recall) + weather/survival were
  // archived in the MVP — their routes are unmounted (the /away endpoint now
  // hangs), so the client calls were removed. See Phase D cleanup.

  const fetchCampaignContext = async () => {
    try {
      const response = await fetch(`/api/dm-session/campaign-context/${character.id}`);
      const data = await response.json();
      setCampaignContext(data);

      // Pre-fill from persistent campaign config (takes priority)
      // This ensures custom concepts, selected NPCs, etc. persist across all sessions
      if (data.campaignConfig) {
        const cfg = data.campaignConfig;
        if (cfg.customConcepts) {
          setCustomConcepts(cfg.customConcepts);
        }
        if (cfg.selectedNpcIds && cfg.selectedNpcIds.length > 0) {
          setSelectedNpcIds(cfg.selectedNpcIds);
        }
        if (cfg.campaignModule && cfg.campaignModule !== 'custom') {
          setSelectedModule(cfg.campaignModule);
        }
        if (data.campaignPlan?.startingLocation) {
          // Campaign's starting_location is the source of truth (resolve name or ID to STARTING_LOCATIONS ID)
          const campLoc = data.campaignPlan.startingLocation;
          const match = STARTING_LOCATIONS.find(loc =>
            loc.id === campLoc || loc.name.toLowerCase() === campLoc.toLowerCase()
          );
          if (match) {
            setStartingLocation(match.id);
          }
        } else if (cfg.startingLocation) {
          setStartingLocation(cfg.startingLocation);
        }
        if (cfg.era) {
          setEra(cfg.era);
        }
        if (cfg.campaignLength) {
          setCampaignLength(cfg.campaignLength);
        }
        if (cfg.arrivalHook) {
          // arrivalHook is stored as the full object { id, name, description }
          const hookId = cfg.arrivalHook.id || cfg.arrivalHook;
          setArrivalHook(hookId);
          if (hookId === 'custom' && cfg.arrivalHook.description) {
            setCustomArrivalHook(cfg.arrivalHook.description);
          }
        }
      }

      // If there are previous sessions, default to continuing the campaign
      if (data.hasPreviousSessions) {
        setContinueCampaign(true);

        // Also load settings from last session config as fallback (for older sessions without campaignConfig)
        if (data.sessionConfig && !data.campaignConfig) {
          if (data.sessionConfig.era) {
            setEra(data.sessionConfig.era.id || '');
          }
          if (data.sessionConfig.startingLocation) {
            setStartingLocation(data.sessionConfig.startingLocation.id || '');
          }
          if (data.sessionConfig.campaignLength) {
            setCampaignLength(data.sessionConfig.campaignLength);
          }
          if (data.sessionConfig.campaignModule && data.sessionConfig.campaignModule.id !== 'custom') {
            setSelectedModule(data.sessionConfig.campaignModule.id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching campaign context:', err);
    }
  };

  const fetchAvailableNpcs = async () => {
    try {
      const response = await fetch('/api/npc/available/campaign');
      const data = await response.json();
      setAvailableNpcs(data);
    } catch (err) {
      console.error('Error fetching available NPCs:', err);
    }
  };

  const fetchCampaignNotes = async () => {
    setNotesLoading(true);
    try {
      const response = await fetch(`/api/character/${character.id}/campaign-notes`);
      const data = await response.json();
      setCampaignNotes(data.notes || '');
      setCharacterMemories(data.characterMemories || '');
    } catch (err) {
      console.error('Error fetching campaign notes:', err);
    } finally {
      setNotesLoading(false);
    }
  };

  const saveCampaignNotes = async () => {
    setNotesSaving(true);
    try {
      const response = await fetch(`/api/character/${character.id}/campaign-notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: campaignNotes })
      });
      if (response.ok) {
        setShowCampaignNotes(false);
      }
    } catch (err) {
      console.error('Error saving campaign notes:', err);
    } finally {
      setNotesSaving(false);
    }
  };

  const openCampaignNotes = () => {
    fetchCampaignNotes();
    setShowCampaignNotes(true);
  };

  const generateCampaignNotes = async () => {
    setNotesGenerating(true);
    try {
      const response = await fetch(`/api/character/${character.id}/generate-campaign-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setCampaignNotes(data.notes || '');
      } else {
        console.error('Failed to generate notes:', data.error);
      }
    } catch (err) {
      console.error('Error generating campaign notes:', err);
    } finally {
      setNotesGenerating(false);
    }
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkLLMStatus = async (pref) => {
    try {
      const p = pref || providerPreference;
      const response = await fetch(`/api/dm-session/llm-status?preference=${p}`);
      const data = await response.json();
      setLlmStatus(data);
    } catch (err) {
      setLlmStatus({ available: false, error: err.message });
    }
  };

  const checkForActiveSession = async () => {
    try {
      const response = await fetch(`/api/dm-session/active/${character.id}`);
      const data = await response.json();
      if (data.session) {
        setActiveSession(data.session);

        // Set game date if available
        if (data.session.gameDate) {
          setGameDate(data.session.gameDate);
        }

        // Check if it's a completed session waiting for claim
        if (data.session.status === 'completed') {
          setSessionEnded(true);
          setSessionRewards(data.session.rewards);
          setSessionSummary(data.session.summary || '');
          setHpChange(data.session.hp_change || 0);
        }

        // Paused sessions: resume them and get the recap
        if (data.session.status === 'paused') {
          // Resume the session on the server - this also generates a recap
          const resumeResponse = await fetch(`/api/dm-session/${data.session.id}/resume`, { method: 'POST' });
          const resumeData = await resumeResponse.json();
          data.session.status = 'active';

          // Store the recap to show to the player
          if (resumeData.recap) {
            setSessionRecap(resumeData.recap);
          }
        }

        // Convert messages to display format
        const displayMessages = data.session.messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            type: m.role === 'user' ? 'action' : 'narrative',
            content: m.content
          }));
        setMessages(displayMessages);
      }

      // Fetch spell slots for caster characters
      fetchSpellSlots();
    } catch (err) {
      console.error('Error checking for active session:', err);
    }
  };

  const fetchSpellSlots = async () => {
    try {
      const response = await fetch(`/api/character/spell-slots/${character.id}`);
      const data = await response.json();
      if (data.max && Object.keys(data.max).length > 0) {
        setSpellSlots({ max: data.max, used: data.used || {} });
      }
    } catch (err) {
      console.error('Error fetching spell slots:', err);
    }
  };

  const useSpellSlot = async (level) => {
    try {
      const response = await fetch(`/api/character/spell-slots/${character.id}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      });
      const data = await response.json();
      if (data.success) {
        setSpellSlots(prev => ({
          ...prev,
          used: { ...prev.used, [level]: (prev.used[level] || 0) + 1 }
        }));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to use spell slot');
    }
  };

  const takeRest = async (restType) => {
    console.log('takeRest called:', restType, 'character.id:', character?.id);
    try {
      const response = await fetch(`/api/character/rest/${character.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restType })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Rest API error:', response.status, errorText);
        setError(`Rest failed: ${response.status}`);
        return;
      }

      const data = await response.json();
      if (data.success) {
        // Update character HP
        if (onCharacterUpdated && data.newHp !== undefined) {
          onCharacterUpdated({ ...character, current_hp: data.newHp });
        }
        // Refresh spell slots (they may have been restored)
        fetchSpellSlots();
        // Long rest advances the calendar by 1 day
        if (restType === 'long' && activeSession?.id) {
          adjustGameDate(1);
        }
        // Auto-clear conditions on rest
        if (restType === 'long') {
          setPlayerConditions(prev => {
            const cleared = getConditionsToClear('long_rest', prev);
            const remaining = prev.filter(c => !cleared.includes(c));
            return reduceExhaustion(remaining);
          });
          setCompanionConditions(prev => {
            const updated = {};
            for (const [name, conds] of Object.entries(prev)) {
              const cleared = getConditionsToClear('long_rest', conds);
              const remaining = conds.filter(c => !cleared.includes(c));
              updated[name] = reduceExhaustion(remaining);
            }
            return updated;
          });
        }
        // Show mechanical result immediately
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `*${data.message}*`
        }]);

        // Async: request AI-generated rest narrative
        if (activeSession?.id) {
          const charName = character.nickname || character.name;
          try {
            const narrativeRes = await fetch(`/api/dm-session/${activeSession.id}/rest-narrative`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ restType, characterName: charName, mechanicalResult: data.message })
            });
            const narrativeData = await narrativeRes.json();
            if (narrativeData.narrative) {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: narrativeData.narrative
              }]);
            }
          } catch (narrativeErr) {
            // Fallback: mechanical result already shown, no need for error
            console.log('Rest narrative unavailable:', narrativeErr.message);
          }
        }
      } else {
        setError(data.error || 'Failed to rest');
      }
    } catch (err) {
      console.error('Rest error:', err);
      setError('Failed to complete rest: ' + err.message);
    }
  };

  const toggleCondition = (condKey, target = 'player', companionName = null) => {
    if (target === 'player') {
      setPlayerConditions(prev =>
        prev.includes(condKey)
          ? prev.filter(c => c !== condKey)
          : [...prev, condKey]
      );
    } else {
      setCompanionConditions(prev => {
        const current = prev[companionName] || [];
        const updated = current.includes(condKey)
          ? current.filter(c => c !== condKey)
          : [...current, condKey];
        return { ...prev, [companionName]: updated };
      });
    }
  };

  const adjustGameDate = async (daysToAdd) => {
    if (!activeSession?.id || !gameDate) return;
    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/adjust-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysToAdd })
      });
      if (!response.ok) {
        throw new Error('Failed to adjust date');
      }
      const data = await response.json();
      if (data.gameDate) {
        setGameDate(data.gameDate);
      }
    } catch (err) {
      console.error('Date adjustment error:', err);
      setError('Failed to adjust date');
    }
  };

  const fetchSessionHistory = async () => {
    try {
      const response = await fetch(`/api/dm-session/history/${character.id}`);
      const data = await response.json();
      setSessionHistory(data.sessions || []);
    } catch (err) {
      console.error('Error fetching session history:', err);
    }
  };

  const clearSessionHistory = async () => {
    if (!confirm('Are you sure you want to clear all past adventure history for this character? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/dm-session/character/${character.id}/history`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setSessionHistory([]);
        setShowHistory(false);
      }
    } catch (err) {
      console.error('Error clearing session history:', err);
      setError('Failed to clear history');
    }
  };

  const startSession = async () => {
    setIsLoading(true);
    setError('');

    // Get campaign module data
    const moduleData = getCampaignModule(selectedModule);

    // Get full location and era data (only for custom adventures)
    const locationData = selectedModule === 'custom'
      ? STARTING_LOCATIONS.find(loc => loc.id === startingLocation)
      : null;
    const eraData = selectedModule === 'custom'
      ? ERAS.find(e => e.id === era)
      : null;
    const hookData = selectedModule === 'custom'
      ? (arrivalHook === 'custom'
        ? { id: 'custom', name: 'Custom', description: customArrivalHook }
        : ARRIVAL_HOOKS.find(h => h.id === arrivalHook))
      : null;

    // Get selected NPCs data
    const selectedNpcs = availableNpcs.filter(npc => selectedNpcIds.includes(npc.id));

    try {
      const response = await fetch('/api/dm-session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          secondCharacterId: secondCharacterId || null,
          // Campaign module (published adventure or custom)
          campaignModule: moduleData,
          // Custom adventure config (only used if module is 'custom')
          startingLocation: locationData || null,
          era: eraData || null,
          arrivalHook: hookData || null,
          customConcepts: customConcepts.trim() || null,
          campaignLength,
          customNpcs: selectedNpcs,
          model: DEFAULT_MODEL,
          providerPreference,
          // Opus is the server-side default (v1.0.99); send 'sonnet' only when the user opts down.
          modelOverride: useSonnet ? 'sonnet' : null,
          // Lean prompt — diagnostic-only path (UI toggle was retired in v1.0.100;
          // see DECISION_LOG "Retire Lean Prompt toggle as production direction").
          // Read fresh from localStorage so a developer can still trigger lean by
          // setting `dndLeanPrompt=1` in the browser console for prompt-design
          // experiments. applyLeanTransforms() is still wired server-side.
          leanPrompt: (() => { try { return localStorage.getItem('dndLeanPrompt') === '1' } catch { return false } })(),
          // Campaign continuity
          continueCampaign: continueCampaign && campaignContext?.hasPreviousSessions,
          previousSessionSummaries: continueCampaign && campaignContext?.recentSummaries
            ? campaignContext.recentSummaries
            : []
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      setActiveSession({
        id: data.sessionId,
        title: data.title,
        startingLocation: locationData,
        era: eraData,
        campaignLength,
        status: 'active'
      });

      // Set game date if returned
      if (data.gameDate) {
        setGameDate(data.gameDate);
      }

      setSceneState(parseSceneTag(data.openingNarrative));
      setMessages([{
        type: 'narrative',
        content: (data.openingNarrative || '').replace(/\[SCENE:[^\]]+\]\s*/gi, '').trim()
      }]);

      setSessionEnded(false);
      setSessionRewards(null);
      setSessionRecap(null);
      setActiveGameTab('adventure');

      // Fetch spell slots for caster characters
      fetchSpellSlots();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Old single-session prelude (startPrelude, PreludeSetup flow) removed in
  // v1.0.44. The prelude-forward character creator lives in CharacterManager
  // via PreludeSetupWizard + PreludeArcPreview and doesn't run inside a
  // DMSession at all.

  const sendAction = async (e, overrideText = null) => {
    e?.preventDefault?.();
    const source = overrideText != null ? overrideText : inputAction;
    if (!source.trim() || isLoading) return;

    const action = source.trim();
    if (overrideText == null) setInputAction('');
    setIsLoading(true);
    setError('');

    // Add action to messages immediately
    setMessages(prev => [...prev, { type: 'action', content: action }]);

    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          providerPreference,
          // Opus is the server-side default (v1.0.99); send 'sonnet' only when the user opts down.
          modelOverride: useSonnet ? 'sonnet' : null,
          // Lean prompt — diagnostic-only (UI toggle retired v1.0.100). Read
          // fresh from localStorage so `dndLeanPrompt=1` in browser console
          // still triggers lean for prompt-design experiments. See /start
          // body construction above for the full context.
          leanPrompt: (() => { try { return localStorage.getItem('dndLeanPrompt') === '1' } catch { return false } })(),
          activeConditions: {
            player: playerConditions,
            companions: companionConditions
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send action');
      }

      setMessages(prev => [...prev, { type: 'narrative', content: data.narrative }]);
      if (data.scene) setSceneState(data.scene);

      // Phase B — mechanical-spine state from the turn response.
      // HP changed on the server → refetch the character so HP shows everywhere.
      if (data.hpChange?.applied && onCharacterUpdated) {
        try {
          const r = await fetch(`/api/character/${character.id}`);
          if (r.ok) onCharacterUpdated(await r.json());
        } catch (e) { /* non-fatal */ }
      }
      // Authoritative persisted player conditions (server wrote characters.debuffs).
      if (Array.isArray(data.conditions)) setPlayerConditions(data.conditions);
      // Active spell effects + concentration (full list after this turn's changes).
      if (Array.isArray(data.activeEffects)) setSpellEffects(data.activeEffects);
      // Advance the initiative tracker to the named combatant / round.
      if (data.turn) {
        setCombatState(prev => {
          if (!prev?.turnOrder?.length) return prev;
          const idx = prev.turnOrder.findIndex(t => String(t.name).toLowerCase() === String(data.turn.combatant).toLowerCase());
          return { ...prev, currentTurn: idx >= 0 ? idx : prev.currentTurn, round: data.turn.round || prev.round };
        });
      }
      // A roll the DM asked for, preloaded with the player's modifier.
      setRollRequest(data.rollRequest || null);

      // Check for recruitment detection
      if (data.recruitment?.detected) {
        setPendingRecruitment(data.recruitment);
      }

      // Track loot drops gained this session
      if (data.lootDrops?.length > 0) {
        setItemsGainedThisSession(prev => [...prev, ...data.lootDrops.map(d => d.item)]);
        // Refresh character to pick up inventory changes. Guard response.ok —
        // on a 4xx/5xx, parsing body would either throw or return an error
        // object that would then clobber character state with corrupt data.
        if (onCharacterUpdated) {
          try {
            const r = await fetch(`/api/character/${character.id}`);
            if (r.ok) {
              onCharacterUpdated(await r.json());
            }
          } catch (e) {
            console.warn('Refresh character after loot drop failed:', e.message);
          }
        }
      }

      // Handle combat start/end
      if (data.combatStart?.turnOrder) {
        setCombatState(data.combatStart);
      }
      if (data.combatEnd) {
        setCombatState(null);
        // Auto-clear combat-end conditions
        setPlayerConditions(prev => prev.filter(c => {
          const cond = CONDITIONS[c];
          return !cond?.autoClear?.includes('combat_end');
        }));
        setCompanionConditions(prev => {
          const updated = {};
          for (const [name, conds] of Object.entries(prev)) {
            updated[name] = conds.filter(c => {
              const cond = CONDITIONS[c];
              return !cond?.autoClear?.includes('combat_end');
            });
          }
          return updated;
        });
      }

      // Handle AI-driven condition changes
      if (data.conditionChanges) {
        if (data.conditionChanges.applied?.length > 0) {
          for (const { target, condition } of data.conditionChanges.applied) {
            if (target.toLowerCase() === 'player') {
              setPlayerConditions(prev => prev.includes(condition) ? prev : [...prev, condition]);
            } else {
              setCompanionConditions(prev => {
                const current = prev[target] || [];
                return { ...prev, [target]: current.includes(condition) ? current : [...current, condition] };
              });
            }
          }
        }
        if (data.conditionChanges.removed?.length > 0) {
          for (const { target, condition } of data.conditionChanges.removed) {
            if (target.toLowerCase() === 'player') {
              setPlayerConditions(prev => prev.filter(c => c !== condition));
            } else {
              setCompanionConditions(prev => ({
                ...prev,
                [target]: (prev[target] || []).filter(c => c !== condition)
              }));
            }
          }
        }
      }

    } catch (err) {
      setError(err.message);
      // Remove the optimistic action bubble on error.
      setMessages(prev => prev.slice(0, -1));
      // Restore the player's typed turn so it isn't silently lost (the server's
      // retryable errors — timeout / overloaded / rate-limit — promise the input
      // is preserved). Only for a normal send (not a quick-action override), and
      // only if the box is still empty so we never clobber fresh typing.
      if (overrideText == null) setInputAction(prev => (prev ? prev : action));
    } finally {
      setIsLoading(false);
    }
  };

  const advanceTurn = () => {
    setCombatState(prev => {
      if (!prev) return null;
      const nextTurn = (prev.currentTurn + 1) % prev.turnOrder.length;
      const nextRound = nextTurn === 0 ? prev.round + 1 : prev.round;
      return { ...prev, currentTurn: nextTurn, round: nextRound };
    });
  };

  const endCombat = () => setCombatState(null);

  // Phase B — resolve a DM roll request: roll d20 (+ advantage/disadvantage),
  // add the player's preloaded modifier, and report the number back so the DM
  // adjudicates against the DC. The system finally knows the result.
  const handleRoll = (rr) => {
    if (!rr || isLoading) return;
    const d1 = 1 + Math.floor(Math.random() * 20);
    let roll = d1, detail = `d20 ${d1}`;
    if (rr.advantage === 'advantage' || rr.advantage === 'disadvantage') {
      const d2 = 1 + Math.floor(Math.random() * 20);
      roll = rr.advantage === 'advantage' ? Math.max(d1, d2) : Math.min(d1, d2);
      detail = `${rr.advantage} (${d1}, ${d2}) → ${roll}`;
    }
    const mod = rr.modifier || 0;
    const total = roll + mod;
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const kindLabel = rr.label || (rr.kind === 'save' ? 'saving throw' : rr.kind === 'attack' ? 'attack roll' : 'ability check');
    const text = `I roll a ${total} for the ${kindLabel} (${detail}${mod !== 0 ? `, ${modStr}` : ''}).`;
    setRollRequest(null);
    sendAction(null, text);
  };

  const discardItem = async (itemName) => {
    try {
      const response = await fetch(`/api/character/${character.id}/discard-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName })
      });
      if (response.ok) {
        const updatedChar = await response.json();
        if (onCharacterUpdated) onCharacterUpdated(updatedChar);
      }
    } catch (err) {
      console.error('Failed to discard item:', err);
    }
  };

  const confirmRecruitment = async (progressionType = 'npc_stats', companionClass = null) => {
    if (!pendingRecruitment?.npc?.id) return;

    setRecruitmentLoading(true);
    try {
      const response = await fetch('/api/companion/recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npc_id: pendingRecruitment.npc.id,
          recruited_by_character_id: character.id,
          recruited_session_id: activeSession.id,
          progression_type: progressionType,
          companion_class: companionClass
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to recruit companion');
      }

      // Show success message in chat
      setMessages(prev => [...prev, {
        type: 'narrative',
        content: `*${pendingRecruitment.npc.name} has joined your party as a permanent companion!*`
      }]);

      setPendingRecruitment(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRecruitmentLoading(false);
    }
  };

  const dismissRecruitment = () => {
    setPendingRecruitment(null);
  };

  const [showEndOptions, setShowEndOptions] = useState(false);

  const pauseSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/pause`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to pause session');
      }

      // Return to home page - session will show as resumable when they return
      setActiveSession(null);
      setMessages([]);
      setShowEndOptions(false);
      setGameDate(null);
      setSessionRecap(null);
      setSpellSlots({ max: {}, used: {} });
      onBack && onBack();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const abortSession = async () => {
    if (!confirm('Are you sure you want to abort? This adventure will not be saved to your history and you won\'t receive any rewards.')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/abort`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to abort session');
      }

      // Reset completely - no rewards, no logging
      setActiveSession(null);
      setMessages([]);
      setShowEndOptions(false);
      setGameDate(null);
      setSessionRecap(null);
      setSpellSlots({ max: {}, used: {} });
      // Return to the roster/dashboard instead of stranding the player in DM
      // setup (matches pauseSession). Phase D fix.
      onBack && onBack();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/end`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to end session');
      }

      // Show summary and rewards
      setSessionEnded(true);
      setSessionSummary(data.summary);
      setSessionRewards(data.rewards);
      setHpChange(data.hpChange || 0);
      setShowEndOptions(false);
      const changes = data.analysis?.inventoryChanges || null;
      setInventoryChanges(changes);
      setExtractedNpcs(data.npcsExtracted || []);

      // Update game date if returned
      if (data.newGameDate) {
        setGameDate(data.newGameDate);
      }

      // Build summary message with time passage
      let summaryContent = data.summary;
      if (data.daysElapsed) {
        summaryContent += `\n\n(${data.daysElapsed} day${data.daysElapsed > 1 ? 's' : ''} have passed)`;
      }

      setMessages(prev => [...prev, {
        type: 'summary',
        content: summaryContent
      }]);

      // Auto-apply inventory changes if any
      const hasChanges = changes && (changes.consumed?.length > 0 || changes.gained?.length > 0 ||
        (changes.goldSpent && (changes.goldSpent.gp > 0 || changes.goldSpent.sp > 0 || changes.goldSpent.cp > 0)));
      if (hasChanges) {
        setPreInventorySnapshot({
          inventory: character.inventory,
          gold_gp: character.gold_gp,
          gold_sp: character.gold_sp,
          gold_cp: character.gold_cp
        });
        try {
          const applyRes = await fetch(`/api/dm-session/${activeSession.id}/apply-inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changes)
          });
          const applyData = await applyRes.json();
          if (applyData.success) {
            setInventoryApplied(true);
            if (onCharacterUpdated && applyData.newInventory) {
              onCharacterUpdated({
                ...character,
                inventory: JSON.stringify(applyData.newInventory),
                gold_gp: applyData.newGold?.gp ?? character.gold_gp,
                gold_sp: applyData.newGold?.sp ?? character.gold_sp,
                gold_cp: applyData.newGold?.cp ?? character.gold_cp
              });
            }
          }
        } catch (applyErr) {
          console.error('Auto-apply inventory failed:', applyErr);
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const claimRewards = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/claim`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim rewards');
      }

      // Update character in parent
      if (onCharacterUpdated && data.character) {
        onCharacterUpdated(data.character);
      }

      // Show companion XP notification if any companions received XP
      if (data.companionXPResults && data.companionXPResults.length > 0) {
        const levelUpCompanions = data.companionXPResults.filter(c => c.canLevelUp);
        if (levelUpCompanions.length > 0) {
          const names = levelUpCompanions.map(c => c.name).join(', ');
          alert(`Companions ready to level up: ${names}\n\nVisit the Companions section on your character sheet to level them up!`);
        }
      }

      // Reset state
      setActiveSession(null);
      setSessionEnded(false);
      setSessionRewards(null);
      setMessages([]);
      setGameDate(null);
      setSessionRecap(null);
      setSpellSlots({ max: {}, used: {} });
      fetchSessionHistory();
      fetchCampaignContext(); // Refresh campaign context to show updated session recap
      // Return to the roster/dashboard after claiming, instead of stranding the
      // player in DM setup (matches pauseSession). Phase D fix.
      onBack && onBack();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const applyInventoryChanges = async () => {
    if (!inventoryChanges || inventoryApplied) return;
    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/apply-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inventoryChanges)
      });
      const data = await response.json();
      if (data.success) {
        setInventoryApplied(true);
        // Update character if callback provided
        if (onCharacterUpdated && data.newInventory) {
          onCharacterUpdated({
            ...character,
            inventory: JSON.stringify(data.newInventory),
            gold_gp: data.newGold?.gp || character.gold_gp,
            gold_sp: data.newGold?.sp || character.gold_sp,
            gold_cp: data.newGold?.cp || character.gold_cp
          });
        }
      }
    } catch (err) {
      console.error('Error applying inventory:', err);
      setError('Failed to apply inventory changes');
    }
  };

  const undoInventoryChanges = async () => {
    if (!preInventorySnapshot) return;
    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory: preInventorySnapshot.inventory,
          gold_gp: preInventorySnapshot.gold_gp,
          gold_sp: preInventorySnapshot.gold_sp,
          gold_cp: preInventorySnapshot.gold_cp
        })
      });
      if (response.ok) {
        onCharacterUpdated({
          ...character,
          inventory: preInventorySnapshot.inventory,
          gold_gp: preInventorySnapshot.gold_gp,
          gold_sp: preInventorySnapshot.gold_sp,
          gold_cp: preInventorySnapshot.gold_cp
        });
        setInventoryApplied(false);
        setPreInventorySnapshot(null);
      }
    } catch (err) {
      console.error('Undo inventory failed:', err);
    }
  };

  // Format gold display
  const formatGold = (gold) => {
    if (!gold) return '0';
    const parts = [];
    if (gold.gp) parts.push(`${gold.gp} gp`);
    if (gold.sp) parts.push(`${gold.sp} sp`);
    if (gold.cp) parts.push(`${gold.cp} cp`);
    return parts.join(', ') || '0';
  };

  // Render LLM not available state
  if (llmStatus && !llmStatus.available) {
    return (
      <div className="dm-session-container">
        <div className="dm-session-header">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
          <h2>AI Dungeon Master</h2>
        </div>

        <div className="ollama-error">
          <h3>No AI Provider Available</h3>
          <p>{llmStatus.error}</p>
          <div className="ollama-instructions">
            <h4>To use the AI DM, you need one of these options:</h4>
            <p><strong>Option 1: Claude API (Recommended)</strong></p>
            <ol>
              <li>Get an API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a></li>
              <li>Add <code>ANTHROPIC_API_KEY=your-key</code> to your .env file</li>
              <li>Restart the server</li>
            </ol>
            <p style={{ marginTop: '1rem' }}><strong>Option 2: Ollama (Local/Free)</strong></p>
            <ol>
              <li>Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">ollama.ai</a></li>
              <li>Start Ollama (it runs in the background)</li>
              <li>Pull a model: <code>ollama pull gpt-oss:20b</code></li>
            </ol>
          </div>
          <button onClick={checkLLMStatus} className="retry-btn">
            Check Again
          </button>
        </div>
      </div>
    );
  }

  // Render session history
  if (showHistory) {
    return (
      <div className="dm-session-container">
        <div className="dm-session-header">
          <button className="back-btn" onClick={() => setShowHistory(false)}>&larr; Back</button>
          <h2>Past Adventures</h2>
          {sessionHistory.length > 0 && (
            <button
              className="clear-history-btn"
              onClick={clearSessionHistory}
              style={{
                background: 'rgba(231, 76, 60, 0.2)',
                border: '1px solid #e74c3c',
                color: '#e74c3c',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Clear History
            </button>
          )}
        </div>

        <div className="session-history">
          {sessionHistory.length === 0 ? (
            <p className="no-history">No past adventures yet.</p>
          ) : (
            sessionHistory.map(session => (
              <div key={session.id} className="history-item">
                <h3>{session.title}</h3>
                <div className="history-meta">
                  <span>{session.setting}</span>
                  <span>{new Date(session.start_time).toLocaleDateString()}</span>
                </div>
                {session.summary && (
                  <p className="history-summary">{session.summary}</p>
                )}
                {session.rewards && (
                  <div className="history-rewards">
                    <span>+{session.rewards.xp} XP</span>
                    <span>{formatGold(session.rewards.gold)}</span>
                    {session.rewards.loot && <span>Loot: {session.rewards.loot}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Campaign reference / notes — a Hearth right-side slide-in panel. It is now a
  // self-contained overlay (scrim + aside.pnl.open) rather than a full-screen
  // takeover, so during an active session it slides in OVER the cockpit (rendered
  // alongside SessionCockpit below) instead of unmounting it. Defined once here so
  // the prop wiring is shared by both the in-session and standalone branches.
  const campaignNotesPanel = showCampaignNotes ? (
    <CampaignNotesPanel
      campaignNotes={campaignNotes}
      myNotes={myNotes}
      characterMemories={characterMemories}
      notesTab={notesTab}
      sessionHistory={sessionHistory}
      onClose={() => { setShowCampaignNotes(false); setNotesTab('history'); }}
      onTabChange={(tab) => setNotesTab(tab)}
      onSaveNotes={saveCampaignNotes}
      onGenerateNotes={generateCampaignNotes}
      onMyNotesChange={(newMyNotes, fullNotes) => {
        setMyNotes(newMyNotes);
        setCampaignNotes(fullNotes);
      }}
      notesSaving={notesSaving}
      notesGenerating={notesGenerating}
      notesLoading={notesLoading}
    />
  ) : null;

  // When there is no active session (e.g. opened from setup), render the panel
  // as a standalone self-contained slide-in over a dark scrim.
  if (showCampaignNotes && !(activeSession && !sessionEnded)) {
    return campaignNotesPanel;
  }

  // Render completed session with rewards to claim
  if (activeSession && sessionEnded) {
    return (
      <SessionRewards
        sessionSummary={sessionSummary}
        sessionRewards={sessionRewards}
        hpChange={hpChange}
        inventoryChanges={inventoryChanges}
        inventoryApplied={inventoryApplied}
        preInventorySnapshot={preInventorySnapshot}
        extractedNpcs={extractedNpcs}
        onClaimRewards={claimRewards}
        onApplyInventory={applyInventoryChanges}
        onUndoInventory={undoInventoryChanges}
        isLoading={isLoading}
        character={character}
        messages={messages}
        error={error}
      />
    );
  }

  // Render active session — the campaign-notes panel slides in OVER the cockpit
  // (rendered as a sibling overlay) so opening notes never unmounts the session.
  if (activeSession && !sessionEnded) {
    return (
      <>
        <SessionCockpit
          character={character} companions={companions} secondCharacter={secondCharacter} activeSession={activeSession} sessionNumber={(sessionHistory?.length || 0) + 1}
          messages={messages} isLoading={isLoading} error={error} sessionRecap={sessionRecap} onClearRecap={() => setSessionRecap(null)}
          inputAction={inputAction} onInputChange={setInputAction} onSend={sendAction} messagesEndRef={messagesEndRef}
          combatState={combatState} onAdvanceTurn={advanceTurn} onEndCombat={endCombat}
          playerConditions={playerConditions} companionConditions={companionConditions} onToggleCondition={toggleCondition}
          spellEffects={spellEffects} rollRequest={rollRequest} onRoll={handleRoll}
          spellSlots={spellSlots} gameDate={gameDate} onRest={takeRest} scene={sceneState}
          useSonnet={useSonnet} onToggleModel={() => updateUseSonnet(!useSonnet)}
          showQuickRef={showQuickRef} setShowQuickRef={setShowQuickRef}
          showInventory={showInventory} setShowInventory={setShowInventory}
          showConditionPanel={showConditionPanel} setShowConditionPanel={setShowConditionPanel}
          showCompanionsRef={showCompanionsRef} setShowCompanionsRef={setShowCompanionsRef}
          onOpenNotes={openCampaignNotes}
          showEndOptions={showEndOptions} onShowEnd={() => setShowEndOptions(true)} onCancelEnd={() => setShowEndOptions(false)}
          onPause={pauseSession} onComplete={endSession} onAbort={abortSession}
          pendingRecruitment={pendingRecruitment} recruitmentLoading={recruitmentLoading} onConfirmRecruit={confirmRecruitment} onDismissRecruit={dismissRecruitment}
          itemsGainedThisSession={itemsGainedThisSession} onDiscard={discardItem} onCharacterUpdated={onCharacterUpdated}
        />
        {campaignNotesPanel}
      </>
    );
  }

  // (Old `<PreludeSetup>` branch removed in v1.0.44 — origin-story prelude
  // is gone; the prelude-forward creator runs from the character manager.)

  // Render session setup
  return (
    <SessionSetup
      character={character}
      allCharacters={allCharacters}
      onBack={onBack}
      llmStatus={llmStatus}
      providerPreference={providerPreference}
      onProviderChange={(next) => { setProviderPreference(next); checkLLMStatus(next); }}
      onCheckStatus={() => checkLLMStatus()}
      useSonnet={useSonnet}
      onUseSonnetChange={updateUseSonnet}
      campaignContext={campaignContext}
      continueCampaign={continueCampaign}
      onContinueCampaignChange={setContinueCampaign}
      sessionHistory={sessionHistory}
      onShowHistory={() => setShowHistory(true)}
      selectedModule={selectedModule}
      onSelectedModuleChange={setSelectedModule}
      secondCharacterId={secondCharacterId}
      onSecondCharacterIdChange={setSecondCharacterId}
      startingLocation={startingLocation}
      onStartingLocationChange={setStartingLocation}
      era={era}
      onEraChange={setEra}
      arrivalHook={arrivalHook}
      onArrivalHookChange={setArrivalHook}
      customArrivalHook={customArrivalHook}
      onCustomArrivalHookChange={setCustomArrivalHook}
      customConcepts={customConcepts}
      onCustomConceptsChange={setCustomConcepts}
      campaignLength={campaignLength}
      onCampaignLengthChange={setCampaignLength}
      availableNpcs={availableNpcs}
      selectedNpcIds={selectedNpcIds}
      onSelectedNpcIdsChange={setSelectedNpcIds}
      onStartSession={startSession}
      onOpenCampaignNotes={openCampaignNotes}
      isLoading={isLoading}
      error={error}
    />
  );
}
