import { useState, useEffect, useRef } from 'react';
import {
  STARTING_LOCATIONS,
  ERAS,
  ARRIVAL_HOOKS,
  CAMPAIGN_LENGTHS
} from '../data/forgottenRealms';
import { getCampaignModule } from '../data/campaignModules';
import { SEASON_ICONS } from '../data/harptos';
import Downtime from './Downtime';
import MetaGameDashboard from './MetaGameDashboard';
import InventoryPanel from './InventoryPanel';
import CombatTracker from './CombatTracker';
import SessionSetup from './SessionSetup';
import SessionRewards from './SessionRewards';
import CampaignNotesPanel from './CampaignNotesPanel';
import QuickReferencePanel from './QuickReferencePanel';
import CompanionsPanel from './CompanionsPanel';
import ConditionPanel from './ConditionPanel';
import { CONDITIONS, getConditionsToClear, reduceExhaustion } from '../data/conditions';

// Default model for D&D sessions (used when Ollama is the provider)
const DEFAULT_MODEL = 'gemma3:12b';

export default function DMSession({ character, allCharacters, onBack, onCharacterUpdated }) {
  const [llmStatus, setLlmStatus] = useState(null);
  const [providerPreference, setProviderPreference] = useState('auto'); // 'auto' | 'claude' | 'ollama'

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

  // Downtime detection state
  const [pendingDowntime, setPendingDowntime] = useState(null);
  const [downtimeLoading, setDowntimeLoading] = useState(false);

  // Inventory panel state
  const [showInventory, setShowInventory] = useState(false);
  const [itemsGainedThisSession, setItemsGainedThisSession] = useState([]);

  // Combat tracker state
  const [combatState, setCombatState] = useState(null);

  // Condition tracking state
  const [playerConditions, setPlayerConditions] = useState([]);
  const [companionConditions, setCompanionConditions] = useState({});
  const [showConditionPanel, setShowConditionPanel] = useState(false);

  // Merchant shop state
  const [pendingMerchantShop, setPendingMerchantShop] = useState(null);
  const [merchantInventory, setMerchantInventory] = useState([]);
  const [buybackItems, setBuybackItems] = useState([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [shopCart, setShopCart] = useState({ buying: [], selling: [] });
  const [shopOpen, setShopOpen] = useState(false);
  const [lastMerchantContext, setLastMerchantContext] = useState(null);
  const [transactionProcessing, setTransactionProcessing] = useState(false);
  const [merchantDbId, setMerchantDbId] = useState(null);
  const [merchantPersonality, setMerchantPersonality] = useState(null);
  const [merchantGold, setMerchantGold] = useState(null);

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

      setMessages([{
        type: 'narrative',
        content: data.openingNarrative
      }]);

      setSessionEnded(false);
      setSessionRewards(null);
      setSessionRecap(null);
      setActiveGameTab('adventure');
      setLastMerchantContext(null);
      setMerchantDbId(null);
      setMerchantPersonality(null);
      setMerchantGold(null);

      // Fetch spell slots for caster characters
      fetchSpellSlots();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const sendAction = async (e) => {
    e.preventDefault();
    if (!inputAction.trim() || isLoading) return;

    const action = inputAction.trim();
    setInputAction('');
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

      // Check for recruitment detection
      if (data.recruitment?.detected) {
        setPendingRecruitment(data.recruitment);
      }

      // Check for downtime detection
      if (data.downtime) {
        setPendingDowntime(data.downtime);
      }

      // Track loot drops gained this session
      if (data.lootDrops?.length > 0) {
        setItemsGainedThisSession(prev => [...prev, ...data.lootDrops.map(d => d.item)]);
        // Refresh character to pick up inventory changes
        if (onCharacterUpdated) {
          const updatedChar = await fetch(`/api/character/${character.id}`).then(r => r.json());
          onCharacterUpdated(updatedChar);
        }
      }

      // Check for merchant shop detection
      if (data.merchantShop?.detected) {
        setPendingMerchantShop(data.merchantShop);
        setLastMerchantContext(data.merchantShop);
      } else {
        // Clear stale merchant context when AI response has no merchant interaction
        setLastMerchantContext(null);
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
      // Remove the action on error
      setMessages(prev => prev.slice(0, -1));
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

  // Handle downtime activity
  const startDowntimeActivity = async (activityType, duration, options = {}) => {
    setDowntimeLoading(true);
    try {
      const response = await fetch('/api/downtime/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: character.id,
          activity_type: activityType,
          duration_hours: duration,
          ...options
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start downtime');
      }

      // Show confirmation in chat
      const activityNames = {
        training: 'Training',
        rest: options.restType === 'long' ? 'Long Rest' : (options.restType === 'short' ? 'Short Rest' : 'Rest'),
        study: 'Study',
        crafting: 'Crafting',
        work: 'Work'
      };

      setMessages(prev => [...prev, {
        type: 'narrative',
        content: `*${character.name} begins ${duration} hour${duration !== 1 ? 's' : ''} of ${activityNames[activityType] || activityType}...*`
      }]);

      // Advance game time if we have a game date
      if (gameDate && duration) {
        const hoursToAdvance = duration;
        const daysToAdvance = Math.floor(hoursToAdvance / 24);
        if (daysToAdvance > 0) {
          try {
            await fetch(`/api/dm-session/${activeSession.id}/adjust-date`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ daysToAdd: daysToAdvance })
            });
          } catch (e) {
            console.error('Failed to advance game time:', e);
          }
        }
      }

      setPendingDowntime(null);

      // Refresh character data to show any benefits
      if (onCharacterUpdated) {
        const charResponse = await fetch(`/api/character/${character.id}`);
        if (charResponse.ok) {
          const updatedChar = await charResponse.json();
          onCharacterUpdated(updatedChar);
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setDowntimeLoading(false);
    }
  };

  const dismissDowntime = () => {
    setPendingDowntime(null);
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
      setLastMerchantContext(null);
      setMerchantDbId(null);
      setMerchantPersonality(null);
      setMerchantGold(null);
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
      setLastMerchantContext(null);
      setMerchantDbId(null);
      setMerchantPersonality(null);
      setMerchantGold(null);

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
      setLastMerchantContext(null);
      setMerchantDbId(null);
      setMerchantPersonality(null);
      setMerchantGold(null);
      fetchSessionHistory();
      fetchCampaignContext(); // Refresh campaign context to show updated session recap

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // MERCHANT SHOP FUNCTIONS
  // ============================================================

  const playerInventory = (() => {
    try {
      const inv = typeof character.inventory === 'string'
        ? JSON.parse(character.inventory || '[]')
        : (character.inventory || []);
      return inv;
    } catch { return []; }
  })();

  const playerTotalCp = (character.gold_gp || 0) * 100 + (character.gold_sp || 0) * 10 + (character.gold_cp || 0);

  const calculateBuyTotal = () => {
    let total = 0;
    for (const item of shopCart.buying) {
      total += ((item.price_gp || 0) * 100 + (item.price_sp || 0) * 10 + (item.price_cp || 0)) * item.quantity;
    }
    return total;
  };

  const calculateSellTotal = () => {
    let total = 0;
    for (const item of shopCart.selling) {
      total += ((item.sell_price_gp || 0) * 100 + (item.sell_price_sp || 0) * 10 + (item.sell_price_cp || 0)) * item.quantity;
    }
    return total;
  };

  const netCostCp = calculateBuyTotal() - calculateSellTotal();
  const sellTotalCp = calculateSellTotal();
  const merchantCanAfford = merchantGold === null || sellTotalCp <= merchantGold * 100;
  const canAfford = netCostCp <= playerTotalCp && merchantCanAfford;
  const goldAfterCp = playerTotalCp - netCostCp;

  const formatCopper = (cp) => {
    const gp = Math.floor(cp / 100);
    const sp = Math.floor((cp % 100) / 10);
    const rem = cp % 10;
    const parts = [];
    if (gp > 0) parts.push(`${gp} gp`);
    if (sp > 0) parts.push(`${sp} sp`);
    if (rem > 0) parts.push(`${rem} cp`);
    return parts.length > 0 ? parts.join(', ') : '0 gp';
  };

  const openMerchantShop = async (merchantData) => {
    const ctx = merchantData || lastMerchantContext || pendingMerchantShop;
    if (!ctx) return;
    setMerchantLoading(true);
    setShopOpen(true);
    setPendingMerchantShop(null);
    setShopCart({ buying: [], selling: [] });

    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/generate-merchant-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantName: ctx.merchantName,
          merchantType: ctx.merchantType,
          location: ctx.location,
          characterLevel: character.level || 1,
          characterGold: { gp: character.gold_gp || 0, sp: character.gold_sp || 0, cp: character.gold_cp || 0 },
          playerItems: playerInventory
        })
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('Merchant inventory error:', data.error);
        setShopOpen(false);
        return;
      }
      setMerchantInventory(data.inventory || []);
      setBuybackItems(data.buybackItems || []);
      setMerchantDbId(data.merchantId || null);
      setMerchantPersonality(data.personality || null);
      setMerchantGold(data.merchantGold ?? null);
      // Update context with DB data
      if (data.merchantName) {
        const updatedCtx = { ...ctx, merchantName: data.merchantName, merchantType: data.merchantType || ctx.merchantType };
        setLastMerchantContext(updatedCtx);
      }
    } catch (err) {
      console.error('Failed to load merchant inventory:', err);
      setShopOpen(false);
    } finally {
      setMerchantLoading(false);
    }
  };

  const addToBuyCart = (item) => {
    setShopCart(prev => {
      const existing = prev.buying.find(i => i.name === item.name);
      if (existing) {
        const merchItem = merchantInventory.find(m => m.name === item.name);
        if (existing.quantity >= (merchItem?.quantity || 1)) return prev;
        return { ...prev, buying: prev.buying.map(i => i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      return { ...prev, buying: [...prev.buying, { ...item, quantity: 1 }] };
    });
  };

  const removeFromBuyCart = (itemName) => {
    setShopCart(prev => {
      const existing = prev.buying.find(i => i.name === itemName);
      if (!existing) return prev;
      if (existing.quantity <= 1) return { ...prev, buying: prev.buying.filter(i => i.name !== itemName) };
      return { ...prev, buying: prev.buying.map(i => i.name === itemName ? { ...i, quantity: i.quantity - 1 } : i) };
    });
  };

  const addToSellCart = (item) => {
    setShopCart(prev => {
      const existing = prev.selling.find(i => i.name === item.name);
      const playerItem = playerInventory.find(p => p.name.toLowerCase() === item.name.toLowerCase());
      const maxQty = playerItem?.quantity || 1;
      if (existing) {
        if (existing.quantity >= maxQty) return prev;
        return { ...prev, selling: prev.selling.map(i => i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      return { ...prev, selling: [...prev.selling, { ...item, quantity: 1 }] };
    });
  };

  const removeFromSellCart = (itemName) => {
    setShopCart(prev => {
      const existing = prev.selling.find(i => i.name === itemName);
      if (!existing) return prev;
      if (existing.quantity <= 1) return { ...prev, selling: prev.selling.filter(i => i.name !== itemName) };
      return { ...prev, selling: prev.selling.map(i => i.name === itemName ? { ...i, quantity: i.quantity - 1 } : i) };
    });
  };

  const confirmTransaction = async () => {
    if (!canAfford || transactionProcessing) return;
    setTransactionProcessing(true);
    try {
      const response = await fetch(`/api/dm-session/${activeSession.id}/merchant-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantName: lastMerchantContext?.merchantName || 'Merchant',
          merchantId: merchantDbId,
          bought: shopCart.buying.map(i => ({ name: i.name, quantity: i.quantity, price_gp: i.price_gp, price_sp: i.price_sp, price_cp: i.price_cp })),
          sold: shopCart.selling.map(i => ({ name: i.name, quantity: i.quantity, price_gp: i.sell_price_gp, price_sp: i.sell_price_sp, price_cp: i.sell_price_cp }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onCharacterUpdated({
        ...character,
        inventory: JSON.stringify(data.newInventory),
        gold_gp: data.newGold.gp,
        gold_sp: data.newGold.sp,
        gold_cp: data.newGold.cp
      });

      // Inject transaction context into session
      const boughtStr = shopCart.buying.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const soldStr = shopCart.selling.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const contextMsg = `[Transaction with ${lastMerchantContext?.merchantName || 'merchant'}: ${boughtStr ? `Bought ${boughtStr}` : ''}${boughtStr && soldStr ? '. ' : ''}${soldStr ? `Sold ${soldStr}` : ''}. Net: ${netCostCp > 0 ? `spent ${formatCopper(netCostCp)}` : `earned ${formatCopper(-netCostCp)}`}]`;

      try {
        await fetch(`/api/dm-session/${activeSession.id}/inject-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: contextMsg })
        });
      } catch (e) { console.warn('Context injection failed:', e); }

      setMessages(prev => [...prev, { type: 'narrative', content: `*${contextMsg}*` }]);
      setShopOpen(false);
      setShopCart({ buying: [], selling: [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setTransactionProcessing(false);
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
              <li>Pull a model: <code>ollama pull gemma3:12b</code></li>
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

  // Render campaign notes editor
  if (showCampaignNotes) {
    return (
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
    );
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

  // Render active session
  if (activeSession && !sessionEnded) {
    return (
      <div className="dm-session-container">
        <div className="dm-session-header">
          <h2>{activeSession.title || 'Adventure in Progress'}</h2>
          <div className="session-controls" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setShowQuickRef(!showQuickRef); setShowCompanionsRef(false); setShowInventory(false); setShowConditionPanel(false); }}
              style={{
                background: showQuickRef ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#60a5fa',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              title="View character sheet, spells, and equipment"
            >
              Character
            </button>
            {companions.length > 0 && (
              <button
                onClick={() => { setShowCompanionsRef(!showCompanionsRef); setShowQuickRef(false); setShowInventory(false); setShowConditionPanel(false); }}
                style={{
                  background: showCompanionsRef ? 'rgba(155, 89, 182, 0.4)' : 'rgba(155, 89, 182, 0.2)',
                  border: '1px solid rgba(155, 89, 182, 0.4)',
                  color: '#9b59b6',
                  padding: '0.5rem 1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
                title="View companion info"
              >
                Party ({companions.length})
              </button>
            )}
            <button
              onClick={openCampaignNotes}
              style={{
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                color: '#a78bfa',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              title="View campaign notes and session history"
            >
              Notes
            </button>
            <button
              onClick={() => { setShowInventory(!showInventory); setShowQuickRef(false); setShowCompanionsRef(false); setShowConditionPanel(false); }}
              style={{
                background: showInventory ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10b981',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              title="View inventory"
            >
              Inventory
            </button>
            <button
              onClick={() => { setShowConditionPanel(!showConditionPanel); setShowQuickRef(false); setShowCompanionsRef(false); setShowInventory(false); }}
              style={{
                background: showConditionPanel ? 'rgba(249, 115, 22, 0.4)' : 'rgba(249, 115, 22, 0.2)',
                border: '1px solid rgba(249, 115, 22, 0.4)',
                color: '#f97316',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                position: 'relative'
              }}
              title="Track conditions and status effects"
            >
              Conditions
              {playerConditions.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  background: '#f97316',
                  color: '#000',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold'
                }}>
                  {playerConditions.length}
                </span>
              )}
            </button>
            <button className="end-session-btn" onClick={() => setShowEndOptions(true)} disabled={isLoading}>
              End Adventure
            </button>
          </div>
        </div>

        {/* Gameplay Tabs */}
        <div style={{
          display: 'flex',
          gap: '0',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '0.5rem'
        }}>
          {[
            { key: 'adventure', label: 'Adventure' },
            { key: 'downtime', label: 'Downtime' },
            { key: 'stats', label: 'Stats' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveGameTab(tab.key)}
              style={{
                padding: '0.6rem 1.25rem',
                background: activeGameTab === tab.key ? 'rgba(155, 89, 182, 0.2)' : 'transparent',
                border: 'none',
                borderBottom: activeGameTab === tab.key ? '2px solid #9b59b6' : '2px solid transparent',
                color: activeGameTab === tab.key ? '#9b59b6' : '#888',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: activeGameTab === tab.key ? '600' : '400',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeGameTab === 'downtime' && (
          <div style={{ padding: '1rem 0' }}>
            <Downtime character={character} onCharacterUpdated={(updatedChar) => {
              // Inject downtime context into the AI session so it knows what happened
              if (activeSession && updatedChar) {
                const hpDiff = updatedChar.current_hp - character.current_hp;
                const goldDiff = (updatedChar.gold || 0) - (character.gold || 0);
                const parts = [];
                if (hpDiff > 0) parts.push(`recovered ${hpDiff} HP (now ${updatedChar.current_hp}/${updatedChar.max_hp})`);
                if (goldDiff > 0) parts.push(`earned ${goldDiff} gold`);
                if (goldDiff < 0) parts.push(`spent ${Math.abs(goldDiff)} gold`);

                if (parts.length > 0) {
                  const contextMsg = `The party completed a downtime activity. ${updatedChar.name} ${parts.join(' and ')}.`;
                  fetch(`/api/dm-session/${activeSession.id}/inject-context`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: contextMsg })
                  }).catch(e => console.error('Failed to inject downtime context:', e));

                  // Also show it in the chat visually
                  setMessages(prev => [...prev, {
                    type: 'narrative',
                    content: `*${contextMsg}*`
                  }]);
                }
              }
              onCharacterUpdated && onCharacterUpdated(updatedChar);
            }} />
          </div>
        )}

        {activeGameTab === 'stats' && (
          <div style={{ padding: '1rem 0' }}>
            <MetaGameDashboard character={character} onCharacterUpdated={onCharacterUpdated} />
          </div>
        )}

        {activeGameTab === 'adventure' && <>
        {/* Quick Reference Panel (Overlay) */}
        {showQuickRef && (
          <QuickReferencePanel
            character={character}
            onClose={() => setShowQuickRef(false)}
            spellSlots={spellSlots}
          />
        )}

        {/* Companions Quick Reference Panel (Overlay) */}
        {showCompanionsRef && companions.length > 0 && (
          <CompanionsPanel
            companions={companions}
            onClose={() => setShowCompanionsRef(false)}
          />
        )}

        {/* Inventory Panel (Overlay) */}
        {showInventory && (
          <InventoryPanel
            character={character}
            itemsGainedThisSession={itemsGainedThisSession}
            onDiscard={discardItem}
            onClose={() => setShowInventory(false)}
            onRefreshCharacter={onCharacterUpdated}
          />
        )}

        {/* Condition Panel (Overlay) */}
        {showConditionPanel && (
          <ConditionPanel
            playerConditions={playerConditions}
            companionConditions={companionConditions}
            companions={companions}
            onToggleCondition={toggleCondition}
            onClose={() => setShowConditionPanel(false)}
          />
        )}

        {/* Game Date and Stats Bar */}
        <div className="session-info-bar" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 1rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          {/* Quick Stats: HP, AC, Gold */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} title={`HP: ${character.current_hp}/${character.max_hp}`}>
              <span style={{ color: '#888' }}>HP:</span>
              <span style={{
                color: character.current_hp <= character.max_hp * 0.25 ? '#ef4444' :
                       character.current_hp <= character.max_hp * 0.5 ? '#f59e0b' : '#10b981',
                fontWeight: 'bold'
              }}>
                {character.current_hp}/{character.max_hp}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Armor Class">
              <span style={{ color: '#888' }}>AC:</span>
              <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{character.armor_class || 10}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Gold">
              <span style={{ color: '#888' }}>Gold:</span>
              <span style={{ color: '#d4af37', fontWeight: 'bold' }}>{character.gold_gp || 0}gp</span>
            </div>
            {/* Active Condition Chips */}
            {playerConditions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                <span style={{ color: '#888' }}>|</span>
                {playerConditions.map(condKey => {
                  const cond = CONDITIONS[condKey];
                  if (!cond) return null;
                  return (
                    <span
                      key={condKey}
                      onClick={() => toggleCondition(condKey, 'player')}
                      title={`${cond.name}: ${cond.description} (click to remove)`}
                      style={{
                        background: `${cond.color}33`,
                        color: cond.color,
                        border: `1px solid ${cond.color}55`,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {cond.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Game Date Display with Controls */}
          {gameDate && (
            <div className="game-date" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#d4af37'
            }}>
              <span>{SEASON_ICONS[gameDate.season] || '📅'}</span>
              <span>{gameDate.displayDate}</span>
              {gameDate.isFestival && (
                <span style={{ color: '#f39c12', marginLeft: '0.25rem' }}>
                  (Festival!)
                </span>
              )}
            </div>
          )}

          {/* Spell Slots Display */}
          {Object.keys(spellSlots.max).length > 0 && (
            <div className="spell-slots-tracker" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <span style={{ color: '#8b5cf6' }}>Spell Slots:</span>
              <span style={{ color: '#6b7280', fontSize: '0.75rem', fontStyle: 'italic' }}>(click to use)</span>
              {Object.entries(spellSlots.max).map(([level, max]) => {
                const used = spellSlots.used[level] || 0;
                const remaining = max - used;
                return (
                  <div
                    key={level}
                    className="spell-slot-level"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: remaining > 0 ? 'pointer' : 'default',
                      opacity: remaining > 0 ? 1 : 0.5
                    }}
                    onClick={() => remaining > 0 && useSpellSlot(parseInt(level))}
                    title={remaining > 0 ? `Click to use a level ${level} slot` : `No level ${level} slots remaining`}
                  >
                    <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{level}:</span>
                    <span style={{
                      color: remaining > 0 ? '#10b981' : '#ef4444'
                    }}>
                      {remaining}/{max}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rest Buttons */}
          <div className="rest-buttons" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginLeft: 'auto'
          }}>
            <button
              onClick={() => takeRest('short')}
              disabled={isLoading}
              style={{
                background: 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)',
                border: '1px solid #718096',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                color: '#e2e8f0',
                fontSize: '0.75rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              title="Take a short rest (1 hour) - Recover HP using Hit Dice"
            >
              <span>⏰</span>
              <span>Short Rest</span>
            </button>
            <button
              onClick={() => takeRest('long')}
              disabled={isLoading}
              style={{
                background: 'linear-gradient(135deg, #553c9a 0%, #44337a 100%)',
                border: '1px solid #805ad5',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                color: '#e9d8fd',
                fontSize: '0.75rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              title="Take a long rest (8 hours) - Recover all HP and spell slots"
            >
              <span>🌙</span>
              <span>Long Rest</span>
            </button>
          </div>
        </div>

        {/* Session Recap (shown when resuming a paused session) */}
        {sessionRecap && (
          <div className="session-recap" style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              color: '#a78bfa',
              fontWeight: 'bold'
            }}>
              <span>📜</span>
              <span>Previously on your adventure...</span>
            </div>
            <p style={{ color: '#e0e0e0', fontStyle: 'italic', margin: 0 }}>
              {sessionRecap}
            </p>
            <button
              onClick={() => setSessionRecap(null)}
              style={{
                marginTop: '0.75rem',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                color: '#a78bfa',
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              Continue Adventure
            </button>
          </div>
        )}

        {showEndOptions && (
          <div className="modal-overlay" onClick={() => setShowEndOptions(false)}>
            <div className="end-adventure-modal" onClick={(e) => e.stopPropagation()}>
              <h2>End Adventure</h2>
              <p className="modal-subtitle">How would you like to end this session?</p>

              <div className="end-option-cards">
                <div className="end-option-card pause" onClick={pauseSession}>
                  <div className="end-option-icon">⏸️</div>
                  <h3>Pause For Now</h3>
                  <p>Save your progress and return later. Your adventure will be waiting exactly where you left off.</p>
                  {isLoading && <span className="loading-text">Pausing...</span>}
                </div>

                <div className="end-option-card complete" onClick={endSession}>
                  <div className="end-option-icon">✅</div>
                  <h3>Complete Adventure</h3>
                  <p>Wrap up this adventure and claim your rewards. The DM will provide a summary of your journey.</p>
                  {isLoading && <span className="loading-text">Completing...</span>}
                </div>

                <div className="end-option-card abort" onClick={abortSession}>
                  <div className="end-option-icon">❌</div>
                  <h3>Abort Adventure</h3>
                  <p>End immediately without saving. No rewards will be given and this session won't appear in your history.</p>
                  {isLoading && <span className="loading-text">Aborting...</span>}
                </div>
              </div>

              <button className="modal-cancel-btn" onClick={() => setShowEndOptions(false)} disabled={isLoading}>
                Cancel - Continue Playing
              </button>
            </div>
          </div>
        )}

        {/* Recruitment Confirmation Modal */}
        {pendingRecruitment && (
          <div className="modal-overlay" onClick={dismissRecruitment}>
            <div className="recruitment-modal" onClick={(e) => e.stopPropagation()} style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '450px',
              width: '90%',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                {pendingRecruitment.npc?.avatar ? (
                  <img
                    src={pendingRecruitment.npc.avatar}
                    alt={pendingRecruitment.npc.name}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #8b5cf6'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}>
                    👤
                  </div>
                )}
                <div>
                  <h3 style={{ margin: 0, color: '#a78bfa' }}>New Companion?</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                    <strong>{pendingRecruitment.npc?.name || pendingRecruitment.npcName}</strong>
                    {pendingRecruitment.npc?.race && ` • ${pendingRecruitment.npc.race}`}
                    {pendingRecruitment.npc?.occupation && ` • ${pendingRecruitment.npc.occupation}`}
                  </p>
                </div>
              </div>

              <p style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                margin: '1rem 0'
              }}>
                {pendingRecruitment.npcNotFound
                  ? `"${pendingRecruitment.npcName}" agreed to join you, but they're not in your NPC database yet. You can add them as a companion manually later.`
                  : `${pendingRecruitment.npc?.name} has agreed to join your party! Would you like to add them as a permanent companion?`
                }
              </p>

              {!pendingRecruitment.npcNotFound && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    onClick={() => confirmRecruitment('npc_stats')}
                    disabled={recruitmentLoading}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                      color: 'white',
                      cursor: recruitmentLoading ? 'wait' : 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {recruitmentLoading ? 'Adding...' : 'Add Companion'}
                  </button>
                  <button
                    onClick={dismissRecruitment}
                    disabled={recruitmentLoading}
                    style={{
                      padding: '0.75rem 1.25rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    Not Now
                  </button>
                </div>
              )}

              {pendingRecruitment.npcNotFound && (
                <button
                  onClick={dismissRecruitment}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    marginTop: '0.5rem'
                  }}
                >
                  Got It
                </button>
              )}
            </div>
          </div>
        )}

        {/* Downtime Activity Confirmation Modal */}
        {pendingDowntime && (
          <div className="modal-overlay" onClick={dismissDowntime}>
            <div className="downtime-modal" onClick={(e) => e.stopPropagation()} style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '450px',
              width: '90%',
              border: '1px solid rgba(46, 204, 113, 0.4)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem'
                }}>
                  {pendingDowntime.type === 'training' && '⚔️'}
                  {pendingDowntime.type === 'rest' && '🛏️'}
                  {pendingDowntime.type === 'study' && '📚'}
                  {pendingDowntime.type === 'crafting' && '🔨'}
                  {pendingDowntime.type === 'work' && '💰'}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#2ecc71' }}>Downtime Activity Detected</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#bbb' }}>
                    {pendingDowntime.type === 'training' && 'Training / Practice'}
                    {pendingDowntime.type === 'rest' && (pendingDowntime.restType === 'long' ? 'Long Rest' : pendingDowntime.restType === 'short' ? 'Short Rest' : 'Rest')}
                    {pendingDowntime.type === 'study' && 'Study / Research'}
                    {pendingDowntime.type === 'crafting' && 'Crafting'}
                    {pendingDowntime.type === 'work' && 'Work for Pay'}
                  </p>
                </div>
              </div>

              <p style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                margin: '1rem 0',
                color: '#ccc'
              }}>
                Would you like to use the Downtime system for this activity? This will track time, apply benefits, and advance the in-game clock.
              </p>

              {/* Duration selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888', fontSize: '0.85rem' }}>
                  Duration (hours):
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  defaultValue={pendingDowntime.duration || (pendingDowntime.type === 'rest' && pendingDowntime.restType === 'long' ? 8 : 4)}
                  id="downtime-duration-input"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  onClick={() => {
                    const duration = parseInt(document.getElementById('downtime-duration-input').value) || 4;
                    startDowntimeActivity(pendingDowntime.type, duration, {
                      restType: pendingDowntime.restType
                    });
                  }}
                  disabled={downtimeLoading}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
                    color: 'white',
                    cursor: downtimeLoading ? 'wait' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {downtimeLoading ? 'Starting...' : 'Start Downtime'}
                </button>
                <button
                  onClick={dismissDowntime}
                  disabled={downtimeLoading}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  Continue Narrative
                </button>
              </div>

              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem', textAlign: 'center' }}>
                "Continue Narrative" lets the DM describe it without mechanics
              </p>
            </div>
          </div>
        )}

        {/* Merchant Shop Detection Prompt */}
        {pendingMerchantShop && (
          <div style={{
            position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px', padding: '1rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1001,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)', maxWidth: '500px'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🏪</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', color: '#f59e0b' }}>{pendingMerchantShop.merchantName}</div>
              <div style={{ fontSize: '0.85rem', color: '#aaa' }}>Open shop to browse wares and trade?</div>
            </div>
            <button onClick={() => openMerchantShop(pendingMerchantShop)} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#000',
              fontWeight: 'bold', cursor: 'pointer'
            }}>Open Shop</button>
            <button onClick={() => setPendingMerchantShop(null)} style={{
              padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent', color: '#888', cursor: 'pointer'
            }}>Dismiss</button>
          </div>
        )}

        {/* Merchant Shop Modal */}
        {shopOpen && (
          <div className="modal-overlay" onClick={() => { setShopOpen(false); setShopCart({ buying: [], selling: [] }); }} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1002,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.99) 0%, rgba(20, 20, 30, 0.99) 100%)',
              borderRadius: '12px', padding: '1.5rem', maxWidth: '850px', width: '95%', maxHeight: '85vh',
              overflow: 'auto', border: '1px solid rgba(245, 158, 11, 0.4)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#f59e0b', fontSize: '1.3rem' }}>
                    🏪 {lastMerchantContext?.merchantName || 'Merchant'}
                  </h2>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>
                    {lastMerchantContext?.merchantType} — {lastMerchantContext?.location}
                  </div>
                  {merchantPersonality && (
                    <div style={{ color: '#a78bfa', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.25rem' }}>
                      "{merchantPersonality}"
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {merchantDbId && (
                    <button onClick={async () => {
                      setMerchantLoading(true);
                      try {
                        const resp = await fetch(`/api/dm-session/${activeSession.id}/restock-merchant`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ merchantId: merchantDbId })
                        });
                        const data = await resp.json();
                        setMerchantInventory(data.inventory || []);
                        setMerchantGold(data.gold_gp);
                        setShopCart({ buying: [], selling: [] });
                      } catch (err) {
                        console.error('Restock failed:', err);
                      } finally {
                        setMerchantLoading(false);
                      }
                    }} disabled={merchantLoading} style={{
                      background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: '6px', color: '#3b82f6', padding: '0.35rem 0.6rem',
                      fontSize: '0.75rem', cursor: 'pointer'
                    }}>
                      Restock
                    </button>
                  )}
                  <button onClick={() => { setShopOpen(false); setShopCart({ buying: [], selling: [] }); }} style={{
                    background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer'
                  }}>✕</button>
                </div>
              </div>

              {/* Gold bar */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem',
                background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', marginBottom: '1rem',
                border: '1px solid rgba(245, 158, 11, 0.2)', flexWrap: 'wrap', gap: '0.25rem'
              }}>
                <span style={{ color: '#f59e0b' }}>Your Gold: {formatCopper(playerTotalCp)}</span>
                {merchantGold !== null && (
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>
                    Merchant's Purse: {merchantGold} gp
                  </span>
                )}
                <span style={{ color: canAfford ? '#10b981' : '#ef4444' }}>
                  After: {formatCopper(Math.max(0, goldAfterCp))}
                  {netCostCp !== 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                    ({netCostCp > 0 ? `-${formatCopper(netCostCp)}` : `+${formatCopper(-netCostCp)}`})
                  </span>}
                </span>
              </div>

              {merchantLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                  Loading merchant inventory...
                </div>
              ) : (
                <>
                  {/* Two-column layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    {/* BUY column */}
                    <div>
                      <h3 style={{ color: '#10b981', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Buy</h3>
                      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                        {merchantInventory.map((item, idx) => {
                          const inCart = shopCart.buying.find(c => c.name === item.name);
                          const remaining = item.quantity - (inCart?.quantity || 0);
                          return (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              padding: '0.5rem', borderRadius: '6px', marginBottom: '0.25rem',
                              background: inCart ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
                              border: inCart ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#ddd' }}>{item.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                  {item.description} {item.rarity !== 'common' && <span style={{
                                    color: item.rarity === 'legendary' ? '#ff8c00' :
                                           item.rarity === 'very_rare' ? '#c084fc' :
                                           item.rarity === 'rare' ? '#60a5fa' :
                                           '#a78bfa'
                                  }}>({item.rarity === 'very_rare' ? 'very rare' : item.rarity})</span>}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  {item.price_gp > 0 && `${item.price_gp}gp`}{item.price_sp > 0 && ` ${item.price_sp}sp`}{item.price_cp > 0 && ` ${item.price_cp}cp`}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#666' }}>×{remaining} left</div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button onClick={() => addToBuyCart(item)} disabled={remaining <= 0} style={{
                                  width: '28px', height: '24px', borderRadius: '4px', border: 'none',
                                  background: remaining > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.05)',
                                  color: remaining > 0 ? '#10b981' : '#555', cursor: remaining > 0 ? 'pointer' : 'default',
                                  fontSize: '0.9rem', fontWeight: 'bold'
                                }}>+</button>
                                {inCart && <button onClick={() => removeFromBuyCart(item.name)} style={{
                                  width: '28px', height: '24px', borderRadius: '4px', border: 'none',
                                  background: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', cursor: 'pointer',
                                  fontSize: '0.9rem', fontWeight: 'bold'
                                }}>-</button>}
                              </div>
                            </div>
                          );
                        })}
                        {merchantInventory.length === 0 && (
                          <div style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>No items available</div>
                        )}
                      </div>
                    </div>

                    {/* SELL column */}
                    <div>
                      <h3 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Sell</h3>
                      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                        {playerInventory.map((item, idx) => {
                          const buyback = buybackItems.find(b => b.name.toLowerCase() === item.name.toLowerCase());
                          const sellPrice = buyback ? buyback.sell_price_gp : 0;
                          const inCart = shopCart.selling.find(c => c.name.toLowerCase() === item.name.toLowerCase());
                          const remaining = (item.quantity || 1) - (inCart?.quantity || 0);
                          if (!buyback || sellPrice <= 0) return null;
                          return (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              padding: '0.5rem', borderRadius: '6px', marginBottom: '0.25rem',
                              background: inCart ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)',
                              border: inCart ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent'
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#ddd' }}>{item.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#888' }}>Qty: {item.quantity || 1}</div>
                              </div>
                              <div style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {sellPrice > 0 && `${sellPrice}gp`}{buyback?.sell_price_sp > 0 && ` ${buyback.sell_price_sp}sp`}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button onClick={() => addToSellCart({ name: item.name, sell_price_gp: buyback?.sell_price_gp || 0, sell_price_sp: buyback?.sell_price_sp || 0, sell_price_cp: buyback?.sell_price_cp || 0 })} disabled={remaining <= 0} style={{
                                  width: '28px', height: '24px', borderRadius: '4px', border: 'none',
                                  background: remaining > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.05)',
                                  color: remaining > 0 ? '#ef4444' : '#555', cursor: remaining > 0 ? 'pointer' : 'default',
                                  fontSize: '0.9rem', fontWeight: 'bold'
                                }}>+</button>
                                {inCart && <button onClick={() => removeFromSellCart(item.name)} style={{
                                  width: '28px', height: '24px', borderRadius: '4px', border: 'none',
                                  background: 'rgba(255,255,255,0.1)', color: '#888', cursor: 'pointer',
                                  fontSize: '0.9rem', fontWeight: 'bold'
                                }}>-</button>}
                              </div>
                            </div>
                          );
                        })}
                        {playerInventory.length === 0 && (
                          <div style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>No items to sell</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cart summary */}
                  {(shopCart.buying.length > 0 || shopCart.selling.length > 0) && (
                    <div style={{
                      background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem',
                      border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem'
                    }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b', fontSize: '0.95rem' }}>Transaction</h4>
                      {shopCart.buying.length > 0 && (
                        <div style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          Buying: {shopCart.buying.map(i => `${i.quantity}x ${i.name}`).join(', ')} = {formatCopper(calculateBuyTotal())}
                        </div>
                      )}
                      {shopCart.selling.length > 0 && (
                        <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          Selling: {shopCart.selling.map(i => `${i.quantity}x ${i.name}`).join(', ')} = +{formatCopper(calculateSellTotal())}
                        </div>
                      )}
                      <div style={{ color: netCostCp > 0 ? '#f59e0b' : '#10b981', fontWeight: 'bold', marginTop: '0.5rem' }}>
                        Net: {netCostCp > 0 ? `-${formatCopper(netCostCp)}` : netCostCp < 0 ? `+${formatCopper(-netCostCp)}` : '0 gp'}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={confirmTransaction}
                      disabled={transactionProcessing || (shopCart.buying.length === 0 && shopCart.selling.length === 0) || !canAfford}
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none',
                        background: canAfford && (shopCart.buying.length > 0 || shopCart.selling.length > 0)
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : 'rgba(255,255,255,0.1)',
                        color: canAfford ? '#000' : '#555', fontWeight: 'bold', cursor: canAfford ? 'pointer' : 'default'
                      }}
                    >
                      {transactionProcessing ? 'Processing...' : !merchantCanAfford ? "Merchant Can't Afford" : !canAfford ? 'Not Enough Gold' : 'Confirm Transaction'}
                    </button>
                    <button onClick={() => { setShopOpen(false); setShopCart({ buying: [], selling: [] }); }} style={{
                      padding: '0.75rem 1.25rem', borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.2)', background: 'transparent',
                      color: '#888', cursor: 'pointer'
                    }}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Combat Tracker (inline, above messages) */}
        {combatState && (
          <CombatTracker
            combatState={combatState}
            onAdvanceTurn={advanceTurn}
            onEndCombat={endCombat}
          />
        )}

        <div className="dm-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`dm-message ${msg.type}`}>
              {msg.type === 'action' && (
                <span className="action-label">
                  {secondCharacter
                    ? `${character.nickname || character.name} & ${secondCharacter.nickname || secondCharacter.name}`
                    : character.nickname || character.name}:
                </span>
              )}
              {msg.type === 'summary' && <span className="summary-label">Adventure Summary:</span>}
              <p>{msg.content}</p>
            </div>
          ))}

          {isLoading && (
            <div className="dm-message narrative loading">
              <span className="loading-dots">The DM is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && <div className="dm-error">{error}</div>}

        {/* Browse Wares button - only shows when AI has detected a merchant in the current interaction */}
        {!shopOpen && !pendingMerchantShop && lastMerchantContext && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', paddingRight: '0.25rem' }}>
            <button
              onClick={() => openMerchantShop(lastMerchantContext)}
              disabled={merchantLoading}
              style={{
                padding: '0.35rem 0.75rem', borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
                fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              🏪 Browse Wares ({lastMerchantContext.merchantName})
            </button>
          </div>
        )}

        <form onSubmit={sendAction} className="dm-input-form">
          <textarea
            value={inputAction}
            onChange={(e) => setInputAction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (inputAction.trim() && !isLoading) {
                  sendAction(e);
                }
              }
            }}
            placeholder={secondCharacter ? "What do you both do? (Shift+Enter for new line)" : "What do you do? (Shift+Enter for new line)"}
            disabled={isLoading}
            autoFocus
            rows={3}
          />
          <button type="submit" disabled={isLoading || !inputAction.trim()}>
            Send
          </button>
        </form>
        </>}
      </div>
    );
  }

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
