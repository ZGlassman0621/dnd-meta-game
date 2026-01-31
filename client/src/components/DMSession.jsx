import { useState, useEffect, useRef } from 'react';
import {
  STARTING_LOCATIONS,
  ERAS,
  ARRIVAL_HOOKS,
  CONTENT_PREFERENCES,
  CAMPAIGN_LENGTHS
} from '../data/forgottenRealms';
import { CAMPAIGN_MODULES, getCampaignModule } from '../data/campaignModules';
import { SEASON_ICONS } from '../data/harptos';

// Default model for D&D sessions (used when Ollama is the provider)
const DEFAULT_MODEL = 'llama3.1:8b';

export default function DMSession({ character, allCharacters, onBack, onCharacterUpdated }) {
  const [llmStatus, setLlmStatus] = useState(null);

  // Campaign module selection
  const [selectedModule, setSelectedModule] = useState('custom');

  // New session setup state
  const [startingLocation, setStartingLocation] = useState('');
  const [era, setEra] = useState('');
  const [arrivalHook, setArrivalHook] = useState('');
  const [customArrivalHook, setCustomArrivalHook] = useState('');
  const [customConcepts, setCustomConcepts] = useState('');
  const [contentPreferences, setContentPreferences] = useState(() => {
    // Initialize with defaults from data
    const defaults = {};
    CONTENT_PREFERENCES.forEach(pref => {
      defaults[pref.id] = pref.defaultEnabled;
    });
    return defaults;
  });
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

  // Quick reference panel state (view character info without leaving game)
  const [showQuickRef, setShowQuickRef] = useState(false);
  const [quickRefTab, setQuickRefTab] = useState('equipment'); // 'equipment', 'spells', 'abilities'

  // Parse campaign notes into AI section and My Notes section
  const parseNotesIntoSections = (notes) => {
    if (!notes) return { aiNotes: '', myNotes: '' };

    // Look for the My Notes section
    const myNotesPatterns = [
      /\n---\n## My Notes\n/i,
      /\n## My Notes\n/i
    ];

    for (const pattern of myNotesPatterns) {
      const match = notes.search(pattern);
      if (match !== -1) {
        const aiSection = notes.substring(0, match).trim();
        const mySection = notes.substring(match).replace(/^[\s\S]*?## My Notes\n/, '').replace(/^\*[^*]+\*\n*/, '').trim();
        return { aiNotes: aiSection, myNotes: mySection };
      }
    }

    // No My Notes section found - everything is AI notes
    return { aiNotes: notes.trim(), myNotes: '' };
  };

  // Reconstruct full notes from sections
  const reconstructNotes = (aiNotes, myNotesContent) => {
    let result = aiNotes.trim();
    result += '\n\n---\n## My Notes\n*Your personal additions - this section is preserved when regenerating*\n\n';
    result += myNotesContent.trim();
    return result;
  };

  // Game date and spell slots state
  const [gameDate, setGameDate] = useState(null);
  const [sessionRecap, setSessionRecap] = useState(null);
  const [spellSlots, setSpellSlots] = useState({ max: {}, used: {} });

  // Recruitment state
  const [pendingRecruitment, setPendingRecruitment] = useState(null);
  const [recruitmentLoading, setRecruitmentLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Check LLM status on mount
  useEffect(() => {
    checkLLMStatus();
    fetchSessionHistory();
    checkForActiveSession();
    fetchAvailableNpcs();
    fetchCampaignContext();
  }, [character.id]);

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
        if (cfg.startingLocation) {
          setStartingLocation(cfg.startingLocation);
        }
        if (cfg.era) {
          setEra(cfg.era);
        }
        if (cfg.campaignLength) {
          setCampaignLength(cfg.campaignLength);
        }
        if (cfg.contentPreferences) {
          setContentPreferences(cfg.contentPreferences);
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
          if (data.sessionConfig.contentPreferences) {
            setContentPreferences(data.sessionConfig.contentPreferences);
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

  const checkLLMStatus = async () => {
    try {
      const response = await fetch('/api/dm-session/llm-status');
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
        // Get pronouns based on character gender
        const g = character.gender?.toLowerCase();
        const pronouns = (g === 'male' || g === 'm')
          ? { subject: 'he', possessive: 'his' }
          : (g === 'female' || g === 'f')
            ? { subject: 'she', possessive: 'her' }
            : { subject: 'they', possessive: 'their' };
        // Show rest message in the narrative
        const charName = character.nickname || character.name;
        const restMessage = restType === 'long'
          ? `*${charName} settles in for a long rest, finding what comfort ${pronouns.subject} can. Hours pass as ${pronouns.subject} sleeps deeply, recovering ${pronouns.possessive} strength.*`
          : `*${charName} takes a short rest, catching ${pronouns.possessive} breath and tending to minor wounds.*`;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `${restMessage}\n\n${data.message}`
        }]);
      } else {
        setError(data.error || 'Failed to rest');
      }
    } catch (err) {
      console.error('Rest error:', err);
      setError('Failed to complete rest: ' + err.message);
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
          contentPreferences,
          campaignLength,
          customNpcs: selectedNpcs,
          model: DEFAULT_MODEL,
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
        body: JSON.stringify({ action })
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

    } catch (err) {
      setError(err.message);
      // Remove the action on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
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
      setInventoryChanges(data.analysis?.inventoryChanges || null);
      setInventoryApplied(false);

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
              <li>Pull a model: <code>ollama pull llama3.1:8b</code></li>
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
    const { aiNotes, myNotes: parsedMyNotes } = parseNotesIntoSections(campaignNotes);

    // Update myNotes state when switching to mynotes tab if not already set
    const currentMyNotes = myNotes || parsedMyNotes;

    const handleMyNotesChange = (newMyNotes) => {
      setMyNotes(newMyNotes);
      // Also update the full campaignNotes
      setCampaignNotes(reconstructNotes(aiNotes, newMyNotes));
    };

    return (
      <div className="dm-session-container">
        <div className="dm-session-header">
          <button className="back-btn" onClick={() => { setShowCampaignNotes(false); setNotesTab('history'); }}>&larr; Back</button>
          <h2>Campaign Reference</h2>
          {notesTab === 'mynotes' && (
            <button
              onClick={saveCampaignNotes}
              disabled={notesSaving}
              style={{
                background: 'rgba(46, 204, 113, 0.2)',
                border: '1px solid #2ecc71',
                color: '#2ecc71',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: notesSaving ? 'wait' : 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {notesSaving ? 'Saving...' : 'Save Notes'}
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '0',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          marginBottom: '1rem'
        }}>
          <button
            onClick={() => setNotesTab('history')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: notesTab === 'history' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: notesTab === 'history' ? '2px solid #3b82f6' : '2px solid transparent',
              color: notesTab === 'history' ? '#60a5fa' : '#888',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: notesTab === 'history' ? 'bold' : 'normal'
            }}
          >
            Session Recaps
          </button>
          <button
            onClick={() => setNotesTab('memory')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: notesTab === 'memory' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: notesTab === 'memory' ? '2px solid #8b5cf6' : '2px solid transparent',
              color: notesTab === 'memory' ? '#a78bfa' : '#888',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: notesTab === 'memory' ? 'bold' : 'normal'
            }}
          >
            AI Memory
          </button>
          <button
            onClick={() => { setNotesTab('mynotes'); if (!myNotes) setMyNotes(parsedMyNotes); }}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: notesTab === 'mynotes' ? 'rgba(46, 204, 113, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: notesTab === 'mynotes' ? '2px solid #2ecc71' : '2px solid transparent',
              color: notesTab === 'mynotes' ? '#2ecc71' : '#888',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: notesTab === 'mynotes' ? 'bold' : 'normal'
            }}
          >
            My Notes
          </button>
        </div>

        <div style={{ padding: '0 1rem 1rem 1rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

          {/* Session History Tab */}
          {notesTab === 'history' && (
            <>
              <p style={{ marginBottom: '1rem', opacity: 0.8, fontSize: '0.9rem' }}>
                Recaps from your previous sessions. Use these to remember what happened.
              </p>
              {sessionHistory.length === 0 ? (
                <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No completed sessions yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {sessionHistory.slice().reverse().map((session, idx) => (
                    <div key={session.id} style={{
                      padding: '1rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '0.5rem' }}>
                        Session {sessionHistory.length - idx}: {session.title}
                      </div>
                      <div style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {session.summary || 'No summary available.'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* AI Memory Tab (read-only) */}
          {notesTab === 'memory' && (
            <>
              <p style={{ marginBottom: '1rem', opacity: 0.8, fontSize: '0.9rem' }}>
                AI-generated campaign memory. This is included in every session to help the AI remember your story.
                <span style={{ color: '#f59e0b' }}> (Read-only - use "My Notes" tab to add your own.)</span>
              </p>

              {/* Generate from history button */}
              {sessionHistory.length > 0 && (
                <button
                  onClick={generateCampaignNotes}
                  disabled={notesGenerating || notesLoading}
                  style={{
                    width: '100%',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    background: notesGenerating
                      ? 'rgba(139, 92, 246, 0.1)'
                      : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                    color: '#a78bfa',
                    cursor: notesGenerating ? 'wait' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {notesGenerating ? (
                    <span className="loading-dots">Analyzing {sessionHistory.length} session(s)...</span>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Regenerate from Past Adventures ({sessionHistory.length} sessions)</span>
                    </>
                  )}
                </button>
              )}

              {notesLoading ? (
                <p>Loading notes...</p>
              ) : (
                <div style={{
                  padding: '1rem',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  minHeight: '200px'
                }}>
                  {aiNotes || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No AI memory yet. Complete a session or click "Regenerate" above.</span>}
                </div>
              )}
            </>
          )}

          {/* My Notes Tab (editable) */}
          {notesTab === 'mynotes' && (
            <>
              <p style={{ marginBottom: '1rem', opacity: 0.8, fontSize: '0.9rem' }}>
                Your personal notes. Add corrections, reminders, or details the AI might have missed.
                <span style={{ color: '#2ecc71' }}> These are preserved when you regenerate AI memory.</span>
              </p>

              <textarea
                value={currentMyNotes}
                onChange={(e) => handleMyNotesChange(e.target.value)}
                placeholder="Add your own notes here...

Examples:
- Captain Morris (not Tobias) sent scouts to check the settlements
- We agreed to leave PRE-DAWN to scout the bandit camp
- Jakob's motivation: proving himself to the church
- Shanion seems interested in herbal remedies - could be a plot hook"
                style={{
                  width: '100%',
                  minHeight: '300px',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(46, 204, 113, 0.3)',
                  background: 'rgba(0,0,0,0.3)',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  resize: 'vertical'
                }}
              />

              <div style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
                <strong>Tips:</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  <li>Correct AI mistakes: "Captain Morris sent the scouts, NOT Tobias"</li>
                  <li>Note specific plans: "We agreed to leave at pre-dawn"</li>
                  <li>Track NPC details: "Jakob is motivated by proving himself"</li>
                  <li>Record items given away: "Gave the merchant our spare rope"</li>
                </ul>
              </div>
            </>
          )}

        </div>
      </div>
    );
  }

  // Render completed session with rewards to claim
  if (activeSession && sessionEnded) {
    return (
      <div className="dm-session-container">
        <div className="dm-session-header">
          <h2>Adventure Complete!</h2>
        </div>

        <div className="dm-messages" style={{ flex: 'none', maxHeight: '200px' }}>
          {messages.slice(-3).map((msg, idx) => (
            <div key={idx} className={`dm-message ${msg.type}`}>
              {msg.type === 'action' && <span className="action-label">{character.name}:</span>}
              {msg.type === 'summary' && <span className="summary-label">Adventure Summary:</span>}
              <p>{msg.content}</p>
            </div>
          ))}
        </div>

        <div className="rewards-container">
          <h3>Session Rewards</h3>

          <div className="rewards-grid">
            <div className="reward-item">
              <span className="reward-label">Experience</span>
              <span className="reward-value xp">+{sessionRewards?.xp || 0} XP</span>
            </div>

            <div className="reward-item">
              <span className="reward-label">Gold</span>
              <span className="reward-value gold">{formatGold(sessionRewards?.gold)}</span>
            </div>

            <div className="reward-item">
              <span className="reward-label">Health</span>
              <span className={`reward-value ${hpChange >= 0 ? 'heal' : 'damage'}`}>
                {hpChange >= 0 ? '+' : ''}{hpChange} HP
              </span>
            </div>

            {sessionRewards?.loot && (
              <div className="reward-item loot">
                <span className="reward-label">Loot Found</span>
                <span className="reward-value">{sessionRewards.loot}</span>
              </div>
            )}
          </div>

          {/* XP Breakdown Section */}
          {sessionRewards?.breakdown?.categories && (
            <div className="xp-breakdown" style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#60a5fa' }}>
                XP Breakdown
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.9rem' }}>
                {sessionRewards.breakdown.categories.combat.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#ef4444' }}>Combat</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.combat.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.categories.exploration.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#22c55e' }}>Exploration</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.exploration.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.categories.quests.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#f59e0b' }}>Quests</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.quests.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.categories.discovery.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#a78bfa' }}>Discovery</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.discovery.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.categories.social.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#ec4899' }}>Social</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.social.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.dangerBonus?.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ color: '#f97316' }}>Danger Bonus</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.dangerBonus.xp} XP</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inventory Changes Section */}
          {inventoryChanges && (inventoryChanges.consumed?.length > 0 || inventoryChanges.gained?.length > 0 ||
            (inventoryChanges.goldSpent && (inventoryChanges.goldSpent.gp > 0 || inventoryChanges.goldSpent.sp > 0 || inventoryChanges.goldSpent.cp > 0))) && (
            <div className="inventory-changes" style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.3)'
            }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#a78bfa' }}>
                📦 Inventory Changes {inventoryApplied && <span style={{ color: '#10b981' }}>✓ Applied</span>}
              </h4>

              {inventoryChanges.consumed?.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#ef4444' }}>Used: </span>
                  <span style={{ color: '#e0e0e0' }}>{inventoryChanges.consumed.join(', ')}</span>
                </div>
              )}

              {inventoryChanges.goldSpent && (inventoryChanges.goldSpent.gp > 0 || inventoryChanges.goldSpent.sp > 0 || inventoryChanges.goldSpent.cp > 0) && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#f59e0b' }}>Spent: </span>
                  <span style={{ color: '#e0e0e0' }}>
                    {[
                      inventoryChanges.goldSpent.gp > 0 && `${inventoryChanges.goldSpent.gp} gp`,
                      inventoryChanges.goldSpent.sp > 0 && `${inventoryChanges.goldSpent.sp} sp`,
                      inventoryChanges.goldSpent.cp > 0 && `${inventoryChanges.goldSpent.cp} cp`
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              {inventoryChanges.gained?.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#10b981' }}>Gained: </span>
                  <span style={{ color: '#e0e0e0' }}>{inventoryChanges.gained.join(', ')}</span>
                </div>
              )}

              {!inventoryApplied && (
                <button
                  onClick={applyInventoryChanges}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Apply Changes
                </button>
              )}
            </div>
          )}

          {/* Companion XP Note */}
          {sessionRewards?.xp > 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              fontSize: '0.9rem'
            }}>
              <span style={{ color: '#a78bfa' }}>👥 Party XP:</span>
              <span style={{ color: '#e0e0e0', marginLeft: '0.5rem' }}>
                All class-based companions will also receive +{sessionRewards.xp} XP
              </span>
            </div>
          )}

          {error && <div className="dm-error">{error}</div>}

          <button
            className="claim-rewards-btn"
            onClick={claimRewards}
            disabled={isLoading}
          >
            {isLoading ? 'Claiming...' : 'Claim Rewards'}
          </button>
        </div>
      </div>
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
              onClick={() => setShowQuickRef(!showQuickRef)}
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
            <button className="end-session-btn" onClick={() => setShowEndOptions(true)} disabled={isLoading}>
              End Adventure
            </button>
          </div>
        </div>

        {/* Quick Reference Panel (Overlay) */}
        {showQuickRef && (
          <div className="quick-ref-overlay" style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '400px',
            maxWidth: '90vw',
            height: '100vh',
            background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
            borderLeft: '1px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Panel Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, color: '#60a5fa' }}>
                {character.nickname || character.name}
              </h3>
              <button
                onClick={() => setShowQuickRef(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                ×
              </button>
            </div>

            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              {[
                { id: 'equipment', label: 'Equipment' },
                { id: 'spells', label: 'Spells' },
                { id: 'abilities', label: 'Abilities' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setQuickRefTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: quickRefTab === tab.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    border: 'none',
                    borderBottom: quickRefTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                    color: quickRefTab === tab.id ? '#60a5fa' : '#888',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: quickRefTab === tab.id ? 'bold' : 'normal'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem'
            }}>
              {/* Equipment Tab */}
              {quickRefTab === 'equipment' && (
                <div className="quick-ref-equipment">
                  {/* Weapons */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ color: '#ef4444', marginBottom: '0.5rem', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', paddingBottom: '0.25rem' }}>
                      Weapons
                    </h4>
                    {(() => {
                      const inventory = typeof character.inventory === 'string'
                        ? JSON.parse(character.inventory || '[]')
                        : (character.inventory || []);
                      const weapons = inventory.filter(item =>
                        item.type === 'weapon' || item.damage || item.category?.includes('weapon')
                      );
                      return weapons.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {weapons.map((weapon, idx) => (
                            <div key={idx} style={{
                              padding: '0.5rem',
                              background: 'rgba(239, 68, 68, 0.1)',
                              borderRadius: '4px',
                              fontSize: '0.9rem'
                            }}>
                              <div style={{ fontWeight: 'bold' }}>{weapon.name}</div>
                              {weapon.damage && (
                                <div style={{ color: '#f87171', fontSize: '0.85rem' }}>
                                  Damage: {weapon.damage} {weapon.damageType || ''}
                                </div>
                              )}
                              {weapon.properties && (
                                <div style={{ color: '#888', fontSize: '0.8rem' }}>
                                  {Array.isArray(weapon.properties) ? weapon.properties.join(', ') : weapon.properties}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>No weapons equipped</p>
                      );
                    })()}
                  </div>

                  {/* Armor */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem', borderBottom: '1px solid rgba(59, 130, 246, 0.3)', paddingBottom: '0.25rem' }}>
                      Armor & AC
                    </h4>
                    <div style={{
                      padding: '0.5rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#60a5fa' }}>
                        AC: {character.armor_class || 10}
                      </div>
                      {(() => {
                        const inventory = typeof character.inventory === 'string'
                          ? JSON.parse(character.inventory || '[]')
                          : (character.inventory || []);
                        const armor = inventory.filter(item =>
                          item.type === 'armor' || item.armorClass || item.category?.includes('armor')
                        );
                        return armor.map((item, idx) => (
                          <div key={idx} style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                            {item.name} {item.armorClass ? `(AC ${item.armorClass})` : ''}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Other Items */}
                  <div>
                    <h4 style={{ color: '#a78bfa', marginBottom: '0.5rem', borderBottom: '1px solid rgba(167, 139, 250, 0.3)', paddingBottom: '0.25rem' }}>
                      Inventory
                    </h4>
                    {(() => {
                      const inventory = typeof character.inventory === 'string'
                        ? JSON.parse(character.inventory || '[]')
                        : (character.inventory || []);
                      const otherItems = inventory.filter(item =>
                        item.type !== 'weapon' && item.type !== 'armor' && !item.damage && !item.armorClass
                      );
                      return otherItems.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {otherItems.map((item, idx) => (
                            <span key={idx} style={{
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(167, 139, 250, 0.1)',
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>
                              {item.name || item} {item.quantity > 1 ? `(×${item.quantity})` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>No other items</p>
                      );
                    })()}
                  </div>

                  {/* Gold */}
                  <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '4px' }}>
                    <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>Gold: </span>
                    <span>{character.gold_gp || 0} gp</span>
                    {(character.gold_sp > 0 || character.gold_cp > 0) && (
                      <span style={{ color: '#888' }}>
                        {character.gold_sp > 0 && `, ${character.gold_sp} sp`}
                        {character.gold_cp > 0 && `, ${character.gold_cp} cp`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Spells Tab */}
              {quickRefTab === 'spells' && (
                <div className="quick-ref-spells">
                  {(() => {
                    const spells = typeof character.spells === 'string'
                      ? JSON.parse(character.spells || '[]')
                      : (character.spells || []);

                    if (spells.length === 0) {
                      return (
                        <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
                          No spells known
                        </p>
                      );
                    }

                    // Group spells by level
                    const spellsByLevel = {};
                    spells.forEach(spell => {
                      const level = spell.level !== undefined ? spell.level : 0;
                      if (!spellsByLevel[level]) spellsByLevel[level] = [];
                      spellsByLevel[level].push(spell);
                    });

                    return Object.entries(spellsByLevel)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([level, levelSpells]) => (
                        <div key={level} style={{ marginBottom: '1.5rem' }}>
                          <h4 style={{
                            color: level === '0' ? '#10b981' : '#8b5cf6',
                            marginBottom: '0.5rem',
                            borderBottom: `1px solid ${level === '0' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                            paddingBottom: '0.25rem'
                          }}>
                            {level === '0' ? 'Cantrips' : `Level ${level}`}
                            {level !== '0' && spellSlots.max[level] && (
                              <span style={{ fontWeight: 'normal', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                                ({spellSlots.max[level] - (spellSlots.used[level] || 0)}/{spellSlots.max[level]} slots)
                              </span>
                            )}
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {levelSpells.map((spell, idx) => (
                              <div key={idx} style={{
                                padding: '0.5rem',
                                background: level === '0' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                                borderRadius: '4px',
                                fontSize: '0.9rem'
                              }}>
                                <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>{spell.name}</span>
                                  {spell.damage && (
                                    <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{spell.damage}</span>
                                  )}
                                </div>
                                {spell.school && (
                                  <div style={{ color: '#888', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                    {spell.school}
                                  </div>
                                )}
                                {spell.castingTime && (
                                  <div style={{ color: '#888', fontSize: '0.8rem' }}>
                                    Cast: {spell.castingTime} | Range: {spell.range || 'Self'}
                                  </div>
                                )}
                                {spell.description && (
                                  <div style={{ color: '#ccc', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                    {spell.description.length > 100 ? spell.description.substring(0, 100) + '...' : spell.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              )}

              {/* Abilities Tab */}
              {quickRefTab === 'abilities' && (
                <div className="quick-ref-abilities">
                  {/* Ability Scores */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ color: '#f59e0b', marginBottom: '0.5rem', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', paddingBottom: '0.25rem' }}>
                      Ability Scores
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      {[
                        { abbr: 'STR', full: 'strength' },
                        { abbr: 'DEX', full: 'dexterity' },
                        { abbr: 'CON', full: 'constitution' },
                        { abbr: 'INT', full: 'intelligence' },
                        { abbr: 'WIS', full: 'wisdom' },
                        { abbr: 'CHA', full: 'charisma' }
                      ].map(stat => {
                        const score = character[stat.full] || 10;
                        const modifier = Math.floor((score - 10) / 2);
                        return (
                          <div key={stat.abbr} style={{
                            padding: '0.5rem',
                            background: 'rgba(245, 158, 11, 0.1)',
                            borderRadius: '4px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#fbbf24' }}>{stat.abbr}</div>
                            <div style={{ fontSize: '1.1rem' }}>{score}</div>
                            <div style={{ fontSize: '0.8rem', color: modifier >= 0 ? '#10b981' : '#ef4444' }}>
                              {modifier >= 0 ? '+' : ''}{modifier}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Class Features */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ color: '#ec4899', marginBottom: '0.5rem', borderBottom: '1px solid rgba(236, 72, 153, 0.3)', paddingBottom: '0.25rem' }}>
                      Class Features
                    </h4>
                    {(() => {
                      const features = typeof character.features === 'string'
                        ? JSON.parse(character.features || '[]')
                        : (character.features || []);

                      if (features.length === 0) {
                        return (
                          <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            No class features recorded
                          </p>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {features.map((feature, idx) => (
                            <div key={idx} style={{
                              padding: '0.5rem',
                              background: 'rgba(236, 72, 153, 0.1)',
                              borderRadius: '4px',
                              fontSize: '0.9rem'
                            }}>
                              <div style={{ fontWeight: 'bold' }}>
                                {typeof feature === 'string' ? feature : feature.name}
                              </div>
                              {feature.description && (
                                <div style={{ color: '#ccc', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                  {feature.description.length > 80 ? feature.description.substring(0, 80) + '...' : feature.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Proficiencies */}
                  <div>
                    <h4 style={{ color: '#22c55e', marginBottom: '0.5rem', borderBottom: '1px solid rgba(34, 197, 94, 0.3)', paddingBottom: '0.25rem' }}>
                      Proficiencies
                    </h4>
                    {(() => {
                      const proficiencies = typeof character.proficiencies === 'string'
                        ? JSON.parse(character.proficiencies || '[]')
                        : (character.proficiencies || []);

                      if (proficiencies.length === 0) {
                        return (
                          <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            No proficiencies recorded
                          </p>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {proficiencies.map((prof, idx) => (
                            <span key={idx} style={{
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(34, 197, 94, 0.1)',
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>
                              {typeof prof === 'string' ? prof : prof.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Panel Footer with HP */}
            <div style={{
              padding: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0, 0, 0, 0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#888' }}>HP: </span>
                  <span style={{
                    color: character.current_hp <= character.max_hp * 0.25 ? '#ef4444' :
                           character.current_hp <= character.max_hp * 0.5 ? '#f59e0b' : '#10b981',
                    fontWeight: 'bold'
                  }}>
                    {character.current_hp}/{character.max_hp}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Level </span>
                  <span style={{ fontWeight: 'bold' }}>{character.level}</span>
                  <span style={{ color: '#888' }}> {character.class}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Date and Spell Slots Bar */}
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
          {/* Game Date Display with Controls */}
          {gameDate && (
            <div className="game-date" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#d4af37'
            }}>
              <button
                onClick={() => adjustGameDate(-1)}
                style={{
                  background: 'transparent',
                  border: '1px solid #d4af37',
                  borderRadius: '3px',
                  color: '#d4af37',
                  cursor: 'pointer',
                  padding: '0 0.35rem',
                  fontSize: '0.8rem',
                  lineHeight: '1.2'
                }}
                title="Go back one day"
              >−</button>
              <span>{SEASON_ICONS[gameDate.season] || '📅'}</span>
              <span>{gameDate.displayDate}</span>
              {gameDate.isFestival && (
                <span style={{ color: '#f39c12', marginLeft: '0.25rem' }}>
                  (Festival!)
                </span>
              )}
              <button
                onClick={() => adjustGameDate(1)}
                style={{
                  background: 'transparent',
                  border: '1px solid #d4af37',
                  borderRadius: '3px',
                  color: '#d4af37',
                  cursor: 'pointer',
                  padding: '0 0.35rem',
                  fontSize: '0.8rem',
                  lineHeight: '1.2'
                }}
                title="Advance one day"
              >+</button>
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
      </div>
    );
  }

  // Render session setup
  return (
    <div className="dm-session-container">
      <div className="dm-session-header">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <h2>AI Dungeon Master</h2>
        {sessionHistory.length > 0 && (
          <button className="history-btn" onClick={() => setShowHistory(true)}>
            Past Adventures ({sessionHistory.length})
          </button>
        )}
      </div>

      <div className="dm-setup">
        <div className="party-preview">
          <div className="character-preview">
            <h3>{character.nickname || character.name}</h3>
            <p>Level {character.level} {character.race?.charAt(0).toUpperCase() + character.race?.slice(1)} {character.class?.charAt(0).toUpperCase() + character.class?.slice(1)}</p>
            <p className="hp-display">HP: {character.current_hp}/{character.max_hp}</p>
          </div>

          {secondCharacter && (
            <div className="character-preview secondary">
              <h3>{secondCharacter.nickname || secondCharacter.name}</h3>
              <p>Level {secondCharacter.level} {secondCharacter.race?.charAt(0).toUpperCase() + secondCharacter.race?.slice(1)} {secondCharacter.class?.charAt(0).toUpperCase() + secondCharacter.class?.slice(1)}</p>
              <p className="hp-display">HP: {secondCharacter.current_hp}/{secondCharacter.max_hp}</p>
            </div>
          )}
        </div>

        {llmStatus === null ? (
          <p>Checking AI status...</p>
        ) : (
          <div className="setup-form">
            <div className="llm-status-indicator" style={{
              padding: '0.5rem 1rem',
              marginBottom: '1rem',
              borderRadius: '4px',
              background: llmStatus.provider === 'claude' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(46, 204, 113, 0.15)',
              border: `1px solid ${llmStatus.provider === 'claude' ? '#8b5cf6' : '#2ecc71'}`,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '1rem' }}>{llmStatus.provider === 'claude' ? '🟣' : '🟢'}</span>
              <span>
                <strong>AI Provider:</strong> {llmStatus.provider === 'claude' ? 'Claude (Anthropic)' : 'Ollama (Local)'}
                {llmStatus.model && <span style={{ opacity: 0.7 }}> • {llmStatus.model}</span>}
              </span>
            </div>

            {/* Campaign Continuity - Show if there are previous sessions */}
            {campaignContext?.hasPreviousSessions && (
              <div className="campaign-continuity-section" style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>📜</span>
                  <div>
                    <h4 style={{ margin: 0 }}>Continue Your Story?</h4>
                    <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
                      Last session: {campaignContext.lastSession.title}
                    </p>
                  </div>
                </div>

                {campaignContext.lastSession.summary && (
                  <p style={{
                    fontSize: '0.85rem',
                    fontStyle: 'italic',
                    opacity: 0.9,
                    margin: '0.75rem 0',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '4px'
                  }}>
                    "{campaignContext.lastSession.summary}"
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setContinueCampaign(true)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: continueCampaign ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.2)',
                      background: continueCampaign ? 'rgba(139, 92, 246, 0.3)' : 'rgba(0,0,0,0.2)',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontWeight: continueCampaign ? 'bold' : 'normal'
                    }}
                  >
                    Continue Campaign
                    <br />
                    <small style={{ opacity: 0.7 }}>Keep settings, AI knows your story</small>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContinueCampaign(false)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: !continueCampaign ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.2)',
                      background: !continueCampaign ? 'rgba(139, 92, 246, 0.3)' : 'rgba(0,0,0,0.2)',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontWeight: !continueCampaign ? 'bold' : 'normal'
                    }}
                  >
                    New Adventure
                    <br />
                    <small style={{ opacity: 0.7 }}>Fresh start, new settings</small>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openCampaignNotes}
                  style={{
                    width: '100%',
                    marginTop: '0.75rem',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  📝 View/Edit Campaign Memory
                </button>
              </div>
            )}

            {/* Campaign Notes button for new characters without previous sessions */}
            {!campaignContext?.hasPreviousSessions && (
              <button
                type="button"
                onClick={openCampaignNotes}
                style={{
                  width: '100%',
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                📝 Add Campaign Notes (Optional)
              </button>
            )}

            {/* Campaign Module Selection */}
            <div className="form-group">
              <label>Campaign Type</label>
              <div className="campaign-module-grid">
                {CAMPAIGN_MODULES.map(module => (
                  <div
                    key={module.id}
                    className={`campaign-module-card ${selectedModule === module.id ? 'selected' : ''}`}
                    onClick={() => setSelectedModule(module.id)}
                  >
                    <span className="module-icon">{module.icon}</span>
                    <div className="module-info">
                      <h4>{module.name}</h4>
                      <p className="module-level">Levels {module.suggestedLevel}</p>
                      {module.year && <span className="module-year">{module.year}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {selectedModule && (
                <div className="module-description-box">
                  <p className="module-synopsis">{getCampaignModule(selectedModule)?.synopsis}</p>
                  {getCampaignModule(selectedModule)?.type === 'published' && (
                    <div className="module-details">
                      <p><strong>Setting:</strong> {getCampaignModule(selectedModule)?.setting}</p>
                      <p><strong>Themes:</strong> {getCampaignModule(selectedModule)?.themes.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {allCharacters && allCharacters.length > 1 && (
              <div className="form-group">
                <label>Second Player Character (Optional)</label>
                <select
                  value={secondCharacterId || ''}
                  onChange={(e) => setSecondCharacterId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Solo Adventure</option>
                  {allCharacters
                    .filter(c => c.id !== character.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nickname || c.name} - Level {c.level} {c.race} {c.class}
                      </option>
                    ))
                  }
                </select>
                <small>Add a companion to your adventure</small>
              </div>
            )}

            {/* Custom adventure options - only show for custom campaigns */}
            {selectedModule === 'custom' && (
              <>
                <div className="form-group">
                  <label>Where Are You Starting?</label>
                  <select
                    value={startingLocation}
                    onChange={(e) => setStartingLocation(e.target.value)}
                    required
                  >
                    <option value="">Choose a location...</option>
                    <optgroup label="Major Cities">
                      {STARTING_LOCATIONS.filter(loc => loc.type === 'city').map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.region})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Regions & Wilderness">
                      {STARTING_LOCATIONS.filter(loc => loc.type === 'region').map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  {startingLocation && (
                    <small className="location-description">
                      {STARTING_LOCATIONS.find(loc => loc.id === startingLocation)?.description}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>What Year Is It?</label>
                  <select
                    value={era}
                    onChange={(e) => setEra(e.target.value)}
                    required
                  >
                    <option value="">Choose an era...</option>
                    {ERAS.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  {era && (
                    <small className="era-description">
                      {ERAS.find(e => e.id === era)?.description}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>What Brought You Here?</label>
                  <small style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>
                    Your character's backstory reason for being in this region
                  </small>
                  <select
                    value={arrivalHook}
                    onChange={(e) => setArrivalHook(e.target.value)}
                    required
                  >
                    <option value="">Choose your backstory hook...</option>
                    {ARRIVAL_HOOKS.map(hook => (
                      <option key={hook.id} value={hook.id}>{hook.name}</option>
                    ))}
                  </select>
                  {arrivalHook && arrivalHook !== 'custom' && (
                    <small className="hook-description">
                      {ARRIVAL_HOOKS.find(h => h.id === arrivalHook)?.description}
                    </small>
                  )}
                  {arrivalHook === 'custom' && (
                    <textarea
                      value={customArrivalHook}
                      onChange={(e) => setCustomArrivalHook(e.target.value)}
                      placeholder="What originally brought your character to this region? (e.g., fleeing past troubles, following a rumor, returning home after years away...)"
                      rows={3}
                      style={{ marginTop: '0.5rem' }}
                      required
                    />
                  )}
                </div>

                <div className="form-group">
                  <label>Campaign Length</label>
                  <div className="campaign-length-options">
                    {CAMPAIGN_LENGTHS.map(length => (
                      <label key={length.id} className={`campaign-option ${campaignLength === length.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="campaignLength"
                          value={length.id}
                          checked={campaignLength === length.id}
                          onChange={(e) => setCampaignLength(e.target.value)}
                        />
                        <span className="option-name">{length.name}</span>
                        <span className="option-description">{length.description}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Narrative Vision (Optional)</label>
                  <textarea
                    value={customConcepts}
                    onChange={(e) => setCustomConcepts(e.target.value)}
                    placeholder="What themes do you want this campaign to explore? (e.g., found family, redemption, romance, betrayal, building a legacy, healing from trauma...)"
                    rows={3}
                  />
                  <small>The AI will create situations and NPCs that embody these themes over time</small>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Content Preferences</label>
              <div className="content-preferences-grid">
                {CONTENT_PREFERENCES.map(pref => (
                  <label key={pref.id} className={`content-toggle ${contentPreferences[pref.id] ? 'enabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={contentPreferences[pref.id] || false}
                      onChange={(e) => setContentPreferences(prev => ({
                        ...prev,
                        [pref.id]: e.target.checked
                      }))}
                    />
                    <span className="toggle-name">{pref.name}</span>
                    <span className="toggle-description">{pref.description}</span>
                  </label>
                ))}
              </div>
            </div>

            {availableNpcs.length > 0 && (
              <div className="form-group">
                <label>Include Custom NPCs (Optional)</label>
                <small style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>
                  Select NPCs from your collection to include in this adventure
                </small>
                <div className="npc-selection-grid">
                  {availableNpcs.map(npc => (
                    <label
                      key={npc.id}
                      className={`npc-select-item ${selectedNpcIds.includes(npc.id) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedNpcIds.includes(npc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNpcIds(prev => [...prev, npc.id]);
                          } else {
                            setSelectedNpcIds(prev => prev.filter(id => id !== npc.id));
                          }
                        }}
                      />
                      <div className="npc-select-info">
                        <span className="npc-select-name">{npc.name}</span>
                        <span className="npc-select-details">
                          {npc.race} {npc.occupation ? `• ${npc.occupation}` : ''}
                          {npc.campaign_availability === 'companion' && ' • Companion'}
                          {npc.campaign_availability === 'mention_only' && ' • Mention only'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="dm-error">{error}</div>}

            <button
              className="start-adventure-btn"
              onClick={startSession}
              disabled={isLoading || (selectedModule === 'custom' && (!startingLocation || !era || !arrivalHook || (arrivalHook === 'custom' && !customArrivalHook.trim())))}
            >
              {isLoading ? 'Starting Adventure...' : 'Begin Adventure'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
