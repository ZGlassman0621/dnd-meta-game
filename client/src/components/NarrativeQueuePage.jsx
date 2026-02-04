import { useState, useEffect } from 'react';

export default function NarrativeQueuePage({ character }) {
  const [pendingItems, setPendingItems] = useState([]);
  const [deliveredItems, setDeliveredItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);

  // New item form state
  const [newItem, setNewItem] = useState({
    event_type: 'custom',
    priority: 'normal',
    title: '',
    description: ''
  });

  useEffect(() => {
    if (character?.id) {
      fetchPendingItems();
      fetchDeliveredItems();
    }
  }, [character?.id]);

  const fetchPendingItems = async () => {
    try {
      setLoading(true);
      const url = filterPriority === 'all'
        ? `/api/narrative-queue/${character.id}`
        : `/api/narrative-queue/${character.id}?priority=${filterPriority}`;
      const response = await fetch(url);
      const data = await response.json();
      setPendingItems(data);
    } catch (err) {
      setError('Failed to fetch narrative queue');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveredItems = async () => {
    try {
      const response = await fetch(`/api/narrative-queue/${character.id}/history?limit=50`);
      const data = await response.json();
      setDeliveredItems(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    if (character?.id) {
      fetchPendingItems();
    }
  }, [filterPriority]);

  const handleMarkDelivered = async (itemIds) => {
    try {
      const response = await fetch('/api/narrative-queue/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds })
      });
      if (response.ok) {
        fetchPendingItems();
        fetchDeliveredItems();
        if (selectedItem && itemIds.includes(selectedItem.id)) {
          setSelectedItem(null);
        }
      }
    } catch (err) {
      setError('Failed to mark items as delivered');
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      const response = await fetch(`/api/narrative-queue/${itemId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchPendingItems();
        if (selectedItem?.id === itemId) {
          setSelectedItem(null);
        }
      }
    } catch (err) {
      setError('Failed to delete item');
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.title.trim()) return;

    try {
      const response = await fetch('/api/narrative-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: character.id,
          campaign_id: character.campaign_id,
          ...newItem
        })
      });
      if (response.ok) {
        setNewItem({ event_type: 'custom', priority: 'normal', title: '', description: '' });
        setShowAddForm(false);
        fetchPendingItems();
      }
    } catch (err) {
      setError('Failed to add item');
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'normal': return '🟡';
      case 'low': return '🟢';
      case 'flavor': return '🔵';
      default: return '⚪';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#e74c3c';
      case 'high': return '#e67e22';
      case 'normal': return '#f1c40f';
      case 'low': return '#2ecc71';
      case 'flavor': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const getEventTypeIcon = (eventType) => {
    switch (eventType) {
      case 'adventure_complete': return '⚔️';
      case 'quest_stage_advanced': return '📜';
      case 'quest_completed': return '🏆';
      case 'companion_reaction': return '💬';
      case 'companion_secret_revealed': return '🤫';
      case 'story_thread_activated': return '🧵';
      case 'downtime_event': return '🛏️';
      case 'world_state_change': return '🌍';
      case 'npc_relationship_shift': return '🤝';
      case 'time_sensitive_warning': return '⏰';
      case 'custom': return '📝';
      default: return '📋';
    }
  };

  const getEventTypeLabel = (eventType) => {
    return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const styles = {
    container: {
      display: 'flex',
      height: 'calc(100vh - 120px)',
      gap: '20px',
      padding: '20px'
    },
    listPanel: {
      width: '400px',
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '15px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    },
    detailPanel: {
      flex: 1,
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '20px',
      overflowY: 'auto'
    },
    sectionTitle: {
      color: '#e67e22',
      fontSize: '18px',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    tabs: {
      display: 'flex',
      gap: '10px',
      marginBottom: '15px'
    },
    tab: {
      padding: '8px 16px',
      backgroundColor: '#34495e',
      border: 'none',
      borderRadius: '4px',
      color: '#ecf0f1',
      cursor: 'pointer',
      fontSize: '14px'
    },
    tabActive: {
      backgroundColor: '#e67e22'
    },
    filterRow: {
      display: 'flex',
      gap: '10px',
      marginBottom: '15px',
      alignItems: 'center'
    },
    select: {
      padding: '6px 10px',
      backgroundColor: '#34495e',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '13px'
    },
    itemCard: {
      padding: '12px',
      backgroundColor: '#34495e',
      borderRadius: '6px',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      borderLeft: '4px solid'
    },
    itemCardSelected: {
      backgroundColor: '#4a6278'
    },
    itemHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '6px'
    },
    itemTitle: {
      fontWeight: 'bold',
      color: '#ecf0f1',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    itemBadge: {
      fontSize: '10px',
      padding: '2px 6px',
      borderRadius: '3px',
      color: 'white'
    },
    itemDescription: {
      fontSize: '12px',
      color: '#bdc3c7',
      marginTop: '4px',
      lineHeight: '1.4'
    },
    itemMeta: {
      fontSize: '11px',
      color: '#7f8c8d',
      marginTop: '6px',
      display: 'flex',
      gap: '10px'
    },
    button: {
      padding: '8px 16px',
      backgroundColor: '#e67e22',
      border: 'none',
      borderRadius: '4px',
      color: 'white',
      cursor: 'pointer',
      fontSize: '14px'
    },
    buttonSmall: {
      padding: '4px 10px',
      fontSize: '12px'
    },
    buttonDanger: {
      backgroundColor: '#c0392b'
    },
    buttonSuccess: {
      backgroundColor: '#27ae60'
    },
    detailTitle: {
      color: '#ecf0f1',
      fontSize: '20px',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    detailSection: {
      marginBottom: '20px'
    },
    detailLabel: {
      color: '#7f8c8d',
      fontSize: '12px',
      marginBottom: '4px',
      textTransform: 'uppercase'
    },
    detailContent: {
      color: '#ecf0f1',
      backgroundColor: '#34495e',
      padding: '12px',
      borderRadius: '6px',
      lineHeight: '1.6'
    },
    metaGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '15px',
      marginBottom: '20px'
    },
    metaItem: {
      backgroundColor: '#34495e',
      padding: '10px',
      borderRadius: '6px'
    },
    metaLabel: {
      fontSize: '11px',
      color: '#7f8c8d',
      textTransform: 'uppercase',
      marginBottom: '4px'
    },
    metaValue: {
      color: '#ecf0f1',
      fontSize: '14px'
    },
    actionButtons: {
      display: 'flex',
      gap: '10px',
      marginTop: '20px'
    },
    emptyState: {
      textAlign: 'center',
      color: '#7f8c8d',
      padding: '40px 20px',
      fontSize: '14px'
    },
    form: {
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px',
      marginBottom: '15px'
    },
    formRow: {
      marginBottom: '12px'
    },
    formLabel: {
      display: 'block',
      color: '#bdc3c7',
      fontSize: '12px',
      marginBottom: '4px'
    },
    input: {
      width: '100%',
      padding: '8px',
      backgroundColor: '#2c3e50',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '14px',
      boxSizing: 'border-box'
    },
    textarea: {
      width: '100%',
      padding: '8px',
      backgroundColor: '#2c3e50',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '14px',
      minHeight: '80px',
      resize: 'vertical',
      boxSizing: 'border-box'
    },
    formActions: {
      display: 'flex',
      gap: '10px',
      marginTop: '12px'
    },
    summaryBar: {
      display: 'flex',
      gap: '15px',
      marginBottom: '15px',
      padding: '10px',
      backgroundColor: '#34495e',
      borderRadius: '6px'
    },
    summaryItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      color: '#ecf0f1'
    },
    error: {
      backgroundColor: '#c0392b',
      color: 'white',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '15px'
    },
    listContent: {
      flex: 1,
      overflowY: 'auto'
    }
  };

  const displayItems = activeTab === 'pending' ? pendingItems : deliveredItems;

  // Count by priority
  const urgentCount = pendingItems.filter(i => i.priority === 'urgent').length;
  const highCount = pendingItems.filter(i => i.priority === 'high').length;
  const normalCount = pendingItems.filter(i => i.priority === 'normal').length;

  if (loading) {
    return <div style={styles.emptyState}>Loading narrative queue...</div>;
  }

  if (!character) {
    return <div style={styles.emptyState}>Please select a character first</div>;
  }

  return (
    <div style={styles.container}>
      {/* List Panel */}
      <div style={styles.listPanel}>
        <div style={styles.sectionTitle}>
          📬 Narrative Queue
        </div>

        {/* Summary */}
        <div style={styles.summaryBar}>
          <div style={styles.summaryItem}>
            <span>🔴</span> {urgentCount} Urgent
          </div>
          <div style={styles.summaryItem}>
            <span>🟠</span> {highCount} High
          </div>
          <div style={styles.summaryItem}>
            <span>🟡</span> {normalCount} Normal
          </div>
          <div style={styles.summaryItem}>
            <span>📋</span> {pendingItems.length} Total
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === 'pending' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingItems.length})
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'history' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('history')}
          >
            History ({deliveredItems.length})
          </button>
        </div>

        {/* Filters and Add Button */}
        {activeTab === 'pending' && (
          <div style={styles.filterRow}>
            <select
              style={styles.select}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent Only</option>
              <option value="high">High Only</option>
              <option value="normal">Normal Only</option>
              <option value="low">Low Only</option>
              <option value="flavor">Flavor Only</option>
            </select>
            <button
              style={{ ...styles.button, ...styles.buttonSmall }}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? '✕ Cancel' : '➕ Add'}
            </button>
          </div>
        )}

        {/* Add Form */}
        {showAddForm && activeTab === 'pending' && (
          <form style={styles.form} onSubmit={handleAddItem}>
            <div style={styles.formRow}>
              <label style={styles.formLabel}>Event Type</label>
              <select
                style={styles.select}
                value={newItem.event_type}
                onChange={(e) => setNewItem({ ...newItem, event_type: e.target.value })}
              >
                <option value="custom">Custom</option>
                <option value="story_thread_activated">Story Thread</option>
                <option value="world_state_change">World Change</option>
                <option value="npc_relationship_shift">NPC Relationship</option>
                <option value="time_sensitive_warning">Time Warning</option>
                <option value="downtime_event">Downtime Event</option>
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.formLabel}>Priority</label>
              <select
                style={styles.select}
                value={newItem.priority}
                onChange={(e) => setNewItem({ ...newItem, priority: e.target.value })}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
                <option value="flavor">Flavor</option>
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.formLabel}>Title *</label>
              <input
                style={styles.input}
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="Brief title for this event..."
                required
              />
            </div>
            <div style={styles.formRow}>
              <label style={styles.formLabel}>Description</label>
              <textarea
                style={styles.textarea}
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Detailed description for the DM to incorporate..."
              />
            </div>
            <div style={styles.formActions}>
              <button type="submit" style={styles.button}>
                Add to Queue
              </button>
            </div>
          </form>
        )}

        {error && <div style={styles.error}>{error}</div>}

        {/* Items List */}
        <div style={styles.listContent}>
          {displayItems.length === 0 ? (
            <div style={styles.emptyState}>
              {activeTab === 'pending'
                ? 'No pending narrative events'
                : 'No delivery history yet'}
            </div>
          ) : (
            displayItems.map(item => (
              <div
                key={item.id}
                style={{
                  ...styles.itemCard,
                  borderLeftColor: getPriorityColor(item.priority),
                  ...(selectedItem?.id === item.id ? styles.itemCardSelected : {})
                }}
                onClick={() => setSelectedItem(item)}
              >
                <div style={styles.itemHeader}>
                  <div style={styles.itemTitle}>
                    {getEventTypeIcon(item.event_type)} {item.title}
                  </div>
                  <span style={{
                    ...styles.itemBadge,
                    backgroundColor: getPriorityColor(item.priority)
                  }}>
                    {item.priority}
                  </span>
                </div>
                {item.description && (
                  <div style={styles.itemDescription}>
                    {item.description.length > 100
                      ? item.description.substring(0, 100) + '...'
                      : item.description}
                  </div>
                )}
                <div style={styles.itemMeta}>
                  <span>{getEventTypeLabel(item.event_type)}</span>
                  {item.created_at && (
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  )}
                  {activeTab === 'history' && item.delivered_at && (
                    <span>Delivered: {new Date(item.delivered_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bulk Actions */}
        {activeTab === 'pending' && pendingItems.length > 0 && (
          <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #34495e' }}>
            <button
              style={{ ...styles.button, ...styles.buttonSuccess, width: '100%' }}
              onClick={() => handleMarkDelivered(pendingItems.map(i => i.id))}
            >
              ✓ Mark All as Delivered
            </button>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <div style={styles.detailPanel}>
        {!selectedItem ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: '48px', marginBottom: '20px' }}>📬</p>
            <p>Select a narrative event to view details</p>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#7f8c8d' }}>
              Narrative events are story hooks queued for delivery during DM sessions
            </p>
          </div>
        ) : (
          <>
            <div style={styles.detailTitle}>
              {getEventTypeIcon(selectedItem.event_type)}
              {selectedItem.title}
              <span style={{
                ...styles.itemBadge,
                backgroundColor: getPriorityColor(selectedItem.priority),
                fontSize: '12px'
              }}>
                {selectedItem.priority}
              </span>
            </div>

            <div style={styles.metaGrid}>
              <div style={styles.metaItem}>
                <div style={styles.metaLabel}>Event Type</div>
                <div style={styles.metaValue}>
                  {getEventTypeIcon(selectedItem.event_type)} {getEventTypeLabel(selectedItem.event_type)}
                </div>
              </div>
              <div style={styles.metaItem}>
                <div style={styles.metaLabel}>Status</div>
                <div style={styles.metaValue}>
                  {selectedItem.status === 'pending' ? '⏳ Pending' : '✅ Delivered'}
                </div>
              </div>
              <div style={styles.metaItem}>
                <div style={styles.metaLabel}>Created</div>
                <div style={styles.metaValue}>
                  {selectedItem.created_at
                    ? new Date(selectedItem.created_at).toLocaleString()
                    : 'Unknown'}
                </div>
              </div>
              {selectedItem.delivered_at && (
                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>Delivered</div>
                  <div style={styles.metaValue}>
                    {new Date(selectedItem.delivered_at).toLocaleString()}
                  </div>
                </div>
              )}
              {selectedItem.expires_at && (
                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>Expires</div>
                  <div style={styles.metaValue}>
                    {new Date(selectedItem.expires_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {selectedItem.description && (
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Description</div>
                <div style={styles.detailContent}>
                  {selectedItem.description}
                </div>
              </div>
            )}

            {selectedItem.context && (
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Context</div>
                <div style={styles.detailContent}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                    {typeof selectedItem.context === 'object'
                      ? JSON.stringify(selectedItem.context, null, 2)
                      : selectedItem.context}
                  </pre>
                </div>
              </div>
            )}

            {/* Related Entities */}
            {(selectedItem.related_quest_id || selectedItem.related_location_id ||
              selectedItem.related_companion_id || selectedItem.related_npc_id) && (
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Related Entities</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedItem.related_quest_id && (
                    <span style={{ ...styles.itemBadge, backgroundColor: '#9b59b6' }}>
                      Quest #{selectedItem.related_quest_id}
                    </span>
                  )}
                  {selectedItem.related_location_id && (
                    <span style={{ ...styles.itemBadge, backgroundColor: '#27ae60' }}>
                      Location #{selectedItem.related_location_id}
                    </span>
                  )}
                  {selectedItem.related_companion_id && (
                    <span style={{ ...styles.itemBadge, backgroundColor: '#3498db' }}>
                      Companion #{selectedItem.related_companion_id}
                    </span>
                  )}
                  {selectedItem.related_npc_id && (
                    <span style={{ ...styles.itemBadge, backgroundColor: '#e67e22' }}>
                      NPC #{selectedItem.related_npc_id}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {selectedItem.status === 'pending' && (
              <div style={styles.actionButtons}>
                <button
                  style={{ ...styles.button, ...styles.buttonSuccess }}
                  onClick={() => handleMarkDelivered([selectedItem.id])}
                >
                  ✓ Mark as Delivered
                </button>
                <button
                  style={{ ...styles.button, ...styles.buttonDanger }}
                  onClick={() => handleDeleteItem(selectedItem.id)}
                >
                  🗑️ Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
