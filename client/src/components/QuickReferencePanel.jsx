import { useState } from 'react';
import classesData from '../data/classes.json';
import racesData from '../data/races.json';
import spellsData from '../data/spells.json';

function QuickReferencePanel({ character, onClose, spellSlots }) {
  const [quickRefTab, setQuickRefTab] = useState('equipment');
  const [expandedSpell, setExpandedSpell] = useState(null);

  const getSpellDetails = (spellName) => {
    if (!spellName) return null;
    const lower = spellName.toLowerCase();
    // Check cantrips first
    for (const className of Object.keys(spellsData.cantrips || {})) {
      const cantrip = spellsData.cantrips[className]?.find(s => s.name.toLowerCase() === lower);
      if (cantrip) return { ...cantrip, level: 'Cantrip' };
    }
    // Check leveled spells
    for (const level of Object.keys(spellsData.spells || {})) {
      const spell = spellsData.spells[level]?.find(s => s.name.toLowerCase() === lower);
      if (spell) return { ...spell, spellLevel: level };
    }
    return null;
  };

  return (
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
                onClick={() => onClose()}
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
                  {(() => {
                    const equipment = typeof character.equipment === 'string'
                      ? JSON.parse(character.equipment || '{}')
                      : (character.equipment || {});

                    const ARMOR_DISPLAY_NAMES = {
                      'leather': 'Leather Armor', 'padded': 'Padded Armor',
                      'studded': 'Studded Leather Armor', 'studded leather': 'Studded Leather Armor',
                      'hide': 'Hide Armor', 'scale': 'Scale Mail', 'scale mail': 'Scale Mail',
                      'half plate': 'Half Plate Armor', 'ring mail': 'Ring Mail',
                      'chain mail': 'Chain Mail', 'chain shirt': 'Chain Shirt',
                      'splint': 'Splint Armor', 'plate': 'Plate Armor',
                      'breastplate': 'Breastplate'
                    };
                    const getDisplayName = (name) => ARMOR_DISPLAY_NAMES[(name || '').toLowerCase()] || name;

                    const QUALITY_COLORS = {
                      'Fine': '#60a5fa', 'Superior': '#a78bfa', 'Masterwork': '#fbbf24'
                    };

                    const renderQuality = (item) => {
                      if (!item?.quality || item.quality === 'Standard' || item.quality === 'standard') return null;
                      const label = item.quality.charAt(0).toUpperCase() + item.quality.slice(1);
                      return (
                        <span style={{ color: QUALITY_COLORS[label] || '#888', fontSize: '0.75rem', fontStyle: 'italic' }}>
                          {label}
                        </span>
                      );
                    };

                    return (
                      <>
                        {/* Main Hand Weapon */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <h4 style={{ color: '#ef4444', marginBottom: '0.5rem', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', paddingBottom: '0.25rem' }}>
                            Main Hand
                          </h4>
                          {equipment.mainHand ? (
                            <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', fontSize: '0.9rem' }}>
                              <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{getDisplayName(equipment.mainHand.name || equipment.mainHand)}</span>
                                {renderQuality(equipment.mainHand)}
                              </div>
                              {equipment.mainHand.damage && (
                                <div style={{ color: '#f87171', fontSize: '0.85rem' }}>
                                  Damage: {equipment.mainHand.damage} {equipment.mainHand.damageType || ''}
                                </div>
                              )}
                              {equipment.mainHand.properties && (
                                <div style={{ color: '#888', fontSize: '0.8rem' }}>
                                  {Array.isArray(equipment.mainHand.properties) ? equipment.mainHand.properties.join(', ') : equipment.mainHand.properties}
                                </div>
                              )}
                              {equipment.mainHand.magical && (
                                <div style={{ color: '#a78bfa', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                  {equipment.mainHand.magical}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>No weapon equipped</p>
                          )}
                        </div>

                        {/* Off Hand */}
                        {equipment.offHand && (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem', borderBottom: '1px solid rgba(59, 130, 246, 0.3)', paddingBottom: '0.25rem' }}>
                              Off Hand
                            </h4>
                            <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', fontSize: '0.9rem' }}>
                              <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{getDisplayName(equipment.offHand.name || equipment.offHand)}</span>
                                {renderQuality(equipment.offHand)}
                              </div>
                              {equipment.offHand.acBonus && (
                                <div style={{ color: '#60a5fa', fontSize: '0.85rem' }}>+{equipment.offHand.acBonus} AC</div>
                              )}
                              {equipment.offHand.damage && (
                                <div style={{ color: '#f87171', fontSize: '0.85rem' }}>
                                  Damage: {equipment.offHand.damage} {equipment.offHand.damageType || ''}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Armor & AC */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem', borderBottom: '1px solid rgba(59, 130, 246, 0.3)', paddingBottom: '0.25rem' }}>
                            Armor & AC
                          </h4>
                          <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#60a5fa' }}>
                              AC: {character.armor_class || 10}
                            </div>
                            {equipment.armor ? (
                              <div style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{getDisplayName(equipment.armor.name || equipment.armor)}</span>
                                {renderQuality(equipment.armor)}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                No armor equipped
                              </div>
                            )}
                            {equipment.armor?.magical && (
                              <div style={{ color: '#a78bfa', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                {equipment.armor.magical}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Spells Tab */}
              {quickRefTab === 'spells' && (
                <div className="quick-ref-spells">
                  {(() => {
                    // Parse cantrips and prepared spells from character
                    const cantrips = typeof character.known_cantrips === 'string'
                      ? JSON.parse(character.known_cantrips || '[]')
                      : (character.known_cantrips || []);

                    const preparedSpells = typeof character.prepared_spells === 'string'
                      ? JSON.parse(character.prepared_spells || '[]')
                      : (character.prepared_spells || []);

                    // Add domain/subclass always-prepared spells
                    const charClass = character.class?.toLowerCase();
                    const classInfo = classesData[charClass];
                    if (character.subclass && classInfo?.subclasses) {
                      const subclass = classInfo.subclasses.find(
                        sc => sc.name.toLowerCase() === character.subclass?.toLowerCase()
                      );
                      const spellListKey = subclass?.domainSpells ? 'domainSpells' :
                        subclass?.oathSpells ? 'oathSpells' :
                        subclass?.expandedSpells ? 'expandedSpells' :
                        subclass?.circleSpells ? 'circleSpells' : null;

                      if (spellListKey && subclass[spellListKey]) {
                        Object.entries(subclass[spellListKey]).forEach(([classLevel, spellNames]) => {
                          if (parseInt(classLevel) <= character.level) {
                            spellNames.forEach(spellName => {
                              const alreadyPrepared = preparedSpells.some(s => {
                                const name = typeof s === 'string' ? s : s.name;
                                return name.toLowerCase() === spellName.toLowerCase();
                              });
                              if (!alreadyPrepared) {
                                const details = getSpellDetails(spellName);
                                const spellLevel = details?.spellLevel
                                  ? parseInt(details.spellLevel.replace(/\D/g, ''))
                                  : parseInt(classLevel) <= 1 ? 1 : Math.ceil(parseInt(classLevel) / 2);
                                preparedSpells.push({ name: spellName, level: spellLevel, alwaysPrepared: true });
                              }
                            });
                          }
                        });
                      }
                    }

                    if (cantrips.length === 0 && preparedSpells.length === 0) {
                      const nonCasters = ['barbarian', 'fighter', 'monk', 'rogue'];
                      if (nonCasters.includes(charClass)) {
                        return (
                          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
                            {character.class} does not use spellcasting
                          </p>
                        );
                      }
                      return (
                        <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
                          No spells prepared
                        </p>
                      );
                    }

                    // Group spells by level
                    const spellsByLevel = { 0: [] };

                    cantrips.forEach(cantrip => {
                      const spell = typeof cantrip === 'string' ? { name: cantrip } : cantrip;
                      spellsByLevel[0].push({ ...spell, level: 0 });
                    });

                    preparedSpells.forEach(spell => {
                      const spellObj = typeof spell === 'string' ? { name: spell, level: 1 } : spell;
                      const level = spellObj.level || 1;
                      if (!spellsByLevel[level]) spellsByLevel[level] = [];
                      spellsByLevel[level].push(spellObj);
                    });

                    if (spellsByLevel[0].length === 0) delete spellsByLevel[0];

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
                            {levelSpells.map((spell, idx) => {
                              const details = getSpellDetails(spell.name);
                              const spellKey = `${level}-${idx}`;
                              const isExpanded = expandedSpell === spellKey;
                              return (
                                <div key={idx}
                                  onClick={() => setExpandedSpell(isExpanded ? null : spellKey)}
                                  style={{
                                    padding: '0.5rem',
                                    background: level === '0' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    border: isExpanded ? `1px solid ${level === '0' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(139, 92, 246, 0.4)'}` : '1px solid transparent',
                                    transition: 'border-color 0.2s'
                                  }}
                                >
                                  <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>
                                      {spell.name}
                                      {spell.alwaysPrepared && (
                                        <span style={{ fontSize: '0.7rem', color: '#fbbf24', marginLeft: '0.5rem' }}>(Domain)</span>
                                      )}
                                    </span>
                                    <span style={{ color: '#888', fontSize: '0.75rem' }}>{isExpanded ? '▼' : '▸'}</span>
                                  </div>
                                  {!isExpanded && (details?.school || spell.school) && (
                                    <div style={{ color: '#888', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                      {details?.school || spell.school}
                                    </div>
                                  )}
                                  {isExpanded && (
                                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                                      {(details?.school || spell.school) && (
                                        <div style={{ color: '#888', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '0.25rem' }}>
                                          {details?.school || spell.school}
                                        </div>
                                      )}
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                                        <span><strong style={{ color: '#60a5fa' }}>Cast:</strong> {details?.castingTime || spell.castingTime || '—'}</span>
                                        <span><strong style={{ color: '#60a5fa' }}>Range:</strong> {details?.range || spell.range || 'Self'}</span>
                                        <span><strong style={{ color: '#60a5fa' }}>Duration:</strong> {details?.duration || spell.duration || '—'}</span>
                                        {(details?.components || spell.components) && (
                                          <span><strong style={{ color: '#60a5fa' }}>Comp:</strong> {details?.components || spell.components}</span>
                                        )}
                                      </div>
                                      <div style={{ color: '#ccc', fontSize: '0.8rem', marginTop: '0.25rem', lineHeight: '1.4' }}>
                                        {details?.description || spell.description || 'No description available.'}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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
                    {(() => {
                      // Parse ability_scores from JSON string
                      let abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
                      try {
                        const parsed = typeof character.ability_scores === 'string'
                          ? JSON.parse(character.ability_scores || '{}')
                          : (character.ability_scores || {});
                        abilityScores = { ...abilityScores, ...parsed };
                      } catch (e) {
                        console.error('Error parsing ability_scores:', e);
                      }

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                          {[
                            { abbr: 'STR', key: 'str' },
                            { abbr: 'DEX', key: 'dex' },
                            { abbr: 'CON', key: 'con' },
                            { abbr: 'INT', key: 'int' },
                            { abbr: 'WIS', key: 'wis' },
                            { abbr: 'CHA', key: 'cha' }
                          ].map(stat => {
                            const score = abilityScores[stat.key] || 10;
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
                      );
                    })()}
                  </div>

                  {/* Class Features - loaded from classes.json based on character class/level */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ color: '#ec4899', marginBottom: '0.5rem', borderBottom: '1px solid rgba(236, 72, 153, 0.3)', paddingBottom: '0.25rem' }}>
                      Class Features
                    </h4>
                    {(() => {
                      const features = [];

                      // Generic subclass-choice features that should show the actual chosen subclass
                      const GENERIC_SUBCLASS_FEATURES = [
                        'Divine Domain', 'Martial Archetype', 'Roguish Archetype', 'Monastic Tradition',
                        'Sorcerous Origin', 'Otherworldly Patron', 'Arcane Tradition', 'Primal Path',
                        'Ranger Archetype', 'Sacred Oath', 'Bardic College', 'Druid Circle'
                      ];

                      // Get base class features
                      const charClass = character.class?.toLowerCase();
                      const classInfo = classesData[charClass];

                      if (classInfo?.features) {
                        classInfo.features.forEach(f => {
                          if (typeof f === 'string') {
                            const [name, ...descParts] = f.split(' - ');
                            const trimmedName = name.trim();
                            // Replace generic subclass text with actual chosen subclass
                            if (GENERIC_SUBCLASS_FEATURES.includes(trimmedName) && character.subclass) {
                              features.push({ name: character.subclass, description: `Your chosen ${trimmedName.toLowerCase()}.` });
                            } else {
                              features.push({ name: trimmedName, description: descParts.join(' - ').trim() });
                            }
                          } else {
                            features.push(f);
                          }
                        });
                      }

                      // Get subclass features based on level
                      if (character.subclass && classInfo?.subclasses) {
                        const subclass = classInfo.subclasses.find(
                          sc => sc.name.toLowerCase() === character.subclass?.toLowerCase()
                        );
                        if (subclass?.featuresByLevel) {
                          Object.entries(subclass.featuresByLevel).forEach(([level, levelFeatures]) => {
                            if (parseInt(level) <= character.level) {
                              levelFeatures.forEach(f => {
                                features.push({ ...f, level: parseInt(level), source: subclass.name });
                              });
                            }
                          });
                        }
                      }

                      if (features.length === 0) {
                        return (
                          <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            No class features available
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
                              <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{feature.name}</span>
                                {feature.level && (
                                  <span style={{ color: '#888', fontSize: '0.75rem' }}>Lvl {feature.level}</span>
                                )}
                              </div>
                              {feature.description && (
                                <div style={{ color: '#ccc', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                  {feature.description.length > 120 ? feature.description.substring(0, 120) + '...' : feature.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Skill Proficiencies */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ color: '#22c55e', marginBottom: '0.5rem', borderBottom: '1px solid rgba(34, 197, 94, 0.3)', paddingBottom: '0.25rem' }}>
                      Skill Proficiencies
                    </h4>
                    {(() => {
                      const skills = typeof character.skills === 'string'
                        ? JSON.parse(character.skills || '[]')
                        : (character.skills || []);

                      if (skills.length === 0) {
                        return (
                          <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            No skill proficiencies recorded
                          </p>
                        );
                      }

                      // Format skill names nicely
                      const formatSkill = (skill) => {
                        const name = typeof skill === 'string' ? skill : skill.name;
                        return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                      };

                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {skills.map((skill, idx) => (
                            <span key={idx} style={{
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(34, 197, 94, 0.1)',
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>
                              {formatSkill(skill)}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Armor & Weapon Proficiencies from class */}
                  <div>
                    <h4 style={{ color: '#3b82f6', marginBottom: '0.5rem', borderBottom: '1px solid rgba(59, 130, 246, 0.3)', paddingBottom: '0.25rem' }}>
                      Equipment Proficiencies
                    </h4>
                    {(() => {
                      const charClass = character.class?.toLowerCase();
                      const classInfo = classesData[charClass];

                      if (!classInfo) {
                        return (
                          <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            Class info not found
                          </p>
                        );
                      }

                      const armor = classInfo.armorProficiencies || [];
                      const weapons = classInfo.weaponProficiencies || [];
                      const tools = classInfo.toolProficiencies ? [classInfo.toolProficiencies] : [];

                      return (
                        <div style={{ fontSize: '0.85rem' }}>
                          {armor.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              <span style={{ color: '#60a5fa' }}>Armor: </span>
                              <span style={{ color: '#ccc' }}>{armor.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}</span>
                            </div>
                          )}
                          {weapons.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              <span style={{ color: '#60a5fa' }}>Weapons: </span>
                              <span style={{ color: '#ccc' }}>{weapons.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(', ')}</span>
                            </div>
                          )}
                          {tools.length > 0 && tools[0] && (
                            <div>
                              <span style={{ color: '#60a5fa' }}>Tools: </span>
                              <span style={{ color: '#ccc' }}>{tools.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Racial Traits (filtered — no choice-based placeholders) */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ color: '#14b8a6', marginBottom: '0.5rem', borderBottom: '1px solid rgba(20, 184, 166, 0.3)', paddingBottom: '0.25rem' }}>
                      Racial Traits ({character.subrace || character.race || 'Unknown'})
                    </h4>
                    {(() => {
                      const raceName = character.race?.toLowerCase();
                      const raceInfo = racesData[raceName];

                      if (!raceInfo) {
                        return (
                          <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            Race info not found
                          </p>
                        );
                      }

                      let traits = raceInfo.traits || [];
                      if (character.subrace && raceInfo.subraces) {
                        const subrace = raceInfo.subraces.find(
                          sr => sr.name.toLowerCase() === character.subrace?.toLowerCase()
                        );
                        if (subrace?.traits) {
                          traits = subrace.traits;
                        }
                      }

                      // Filter out choice-based placeholder traits
                      const CHOICE_PREFIXES = ['Extra Language', 'Feat', 'Skills', 'Ability Score Increase', 'Versatile'];
                      const filteredTraits = traits.filter(trait => {
                        const traitName = trait.split(' - ')[0].trim();
                        return !CHOICE_PREFIXES.some(prefix => traitName.startsWith(prefix));
                      });

                      if (filteredTraits.length === 0) {
                        return (
                          <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            No racial traits
                          </p>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {filteredTraits.map((trait, idx) => {
                            const [name, ...descParts] = trait.split(' - ');
                            const description = descParts.join(' - ').trim();
                            return (
                              <div key={idx} style={{
                                padding: '0.5rem',
                                background: 'rgba(20, 184, 166, 0.1)',
                                borderRadius: '4px',
                                fontSize: '0.9rem'
                              }}>
                                <div style={{ fontWeight: 'bold', color: '#5eead4' }}>{name.trim()}</div>
                                {description && (
                                  <div style={{ color: '#ccc', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                    {description.length > 150 ? description.substring(0, 150) + '...' : description}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Languages */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ color: '#06b6d4', marginBottom: '0.5rem', borderBottom: '1px solid rgba(6, 182, 212, 0.3)', paddingBottom: '0.25rem' }}>
                      Languages
                    </h4>
                    {(() => {
                      const charLangs = typeof character.languages === 'string'
                        ? (() => { try { return JSON.parse(character.languages || '[]'); } catch { return character.languages.split(',').map(l => l.trim()).filter(Boolean); } })()
                        : (character.languages || []);
                      const raceLangs = racesData[character.race?.toLowerCase()]?.languages || [];
                      const allLangs = [...new Set([...raceLangs, ...charLangs])].filter(l =>
                        !l.toLowerCase().includes('extra language') && !l.toLowerCase().includes('of your choice') && !l.toLowerCase().includes('one extra')
                      );

                      if (allLangs.length === 0) {
                        return <p style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>No languages recorded</p>;
                      }
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {allLangs.map((lang, idx) => (
                            <span key={idx} style={{
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(6, 182, 212, 0.1)',
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>{lang}</span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Feats */}
                  {(() => {
                    const feats = typeof character.feats === 'string'
                      ? (() => { try { return JSON.parse(character.feats || '[]'); } catch { return []; } })()
                      : (character.feats || []);
                    if (feats.length === 0) return null;
                    return (
                      <div style={{ marginTop: '1.5rem' }}>
                        <h4 style={{ color: '#f97316', marginBottom: '0.5rem', borderBottom: '1px solid rgba(249, 115, 22, 0.3)', paddingBottom: '0.25rem' }}>
                          Feats
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {feats.map((feat, idx) => {
                            const featObj = typeof feat === 'string' ? { name: feat } : feat;
                            return (
                              <div key={idx} style={{
                                padding: '0.5rem',
                                background: 'rgba(249, 115, 22, 0.1)',
                                borderRadius: '4px',
                                fontSize: '0.9rem'
                              }}>
                                <div style={{ fontWeight: 'bold', color: '#fb923c' }}>{featObj.name}</div>
                                {featObj.description && (
                                  <div style={{ color: '#ccc', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                    {featObj.description}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tool Proficiencies */}
                  {(() => {
                    const tools = typeof character.tool_proficiencies === 'string'
                      ? (() => { try { return JSON.parse(character.tool_proficiencies || '[]'); } catch { return []; } })()
                      : (character.tool_proficiencies || []);
                    if (tools.length === 0) return null;
                    return (
                      <div style={{ marginTop: '1.5rem' }}>
                        <h4 style={{ color: '#84cc16', marginBottom: '0.5rem', borderBottom: '1px solid rgba(132, 204, 22, 0.3)', paddingBottom: '0.25rem' }}>
                          Tool Proficiencies
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {tools.map((tool, idx) => (
                            <span key={idx} style={{
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(132, 204, 22, 0.1)',
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>{typeof tool === 'string' ? tool : tool.name}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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
  );
}

export default QuickReferencePanel;
