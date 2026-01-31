// Ollama API endpoint (runs locally)
const OLLAMA_API = 'http://localhost:11434/api/generate';
const ADVENTURE_MODEL = 'llama3.2:3b';  // Fast model for adventure generation
const NARRATIVE_MODEL = 'llama3.2';     // Better model for narrative generation

async function callOllama(prompt, modelName = ADVENTURE_MODEL, temperature = 0.8) {
  const response = await fetch(OLLAMA_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      prompt: prompt,
      stream: false,
      options: {
        temperature: temperature,
        top_p: 0.9,
        num_predict: 300,  // Limit response length
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

export async function generateAdventureOptions(character, riskLevel) {
  const { current_location, current_quest, level, class: charClass, injuries } = character;

  console.log('\n=== GENERATING ADVENTURE OPTIONS ===');
  console.log('Character:', character.name);
  console.log('Location:', current_location);
  console.log('Quest:', current_quest);
  console.log('Risk Level:', riskLevel);
  console.log('Using Ollama model:', ADVENTURE_MODEL);

  // If character is injured, prioritize recovery options
  const injuriesArray = JSON.parse(injuries || '[]');
  const isInjured = injuriesArray.length > 0;

  const prompt = `You are a D&D adventure generator. Create 3 different adventure options for a character with the following context:

Character: Level ${level} ${charClass}
Current Location: ${current_location}
Current Quest: ${current_quest || 'None'}
Injured: ${isInjured ? 'Yes - ' + injuriesArray.join(', ') : 'No'}
Risk Level: ${riskLevel}

${isInjured ? 'IMPORTANT: Since the character is injured, at least one option should focus on recovery/healing.' : ''}

Requirements:
- Adventures must be appropriate for the character's current location
- Adventures should relate to or support the current quest if one exists
- Risk level should be ${riskLevel} - consider appropriate challenges
- Each adventure should be self-contained and completable in the timeframe
- Adventures should feel like D&D downtime activities or side quests

Please provide EXACTLY 3 adventure options in the following JSON format:
{
  "adventures": [
    {
      "title": "Brief adventure title",
      "description": "2-3 sentence description of what the character will do",
      "activity_type": "combat/exploration/social/recovery/crafting/research",
      "estimated_game_hours": 8
    }
  ]
}

Make the adventures interesting, varied, and thematically appropriate. Return ONLY valid JSON, no other text.`;

  try {
    console.log('Calling Ollama API...');
    const responseText = await callOllama(prompt);
    console.log('API call successful!');
    console.log('Response text:', responseText.substring(0, 200) + '...');

    // Try to extract JSON from the response - look for the adventures object
    let jsonMatch = responseText.match(/\{\s*"adventures"\s*:\s*\[[\s\S]*?\]\s*\}/);

    if (!jsonMatch) {
      // Try alternate pattern - just an array
      jsonMatch = responseText.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const adventuresArray = JSON.parse(jsonMatch[0]);
        console.log('Parsed adventures array successfully:', adventuresArray.length, 'options');
        return adventuresArray;
      }
      throw new Error('No JSON found in response');
    }

    const adventures = JSON.parse(jsonMatch[0]);
    console.log('Parsed adventures successfully:', adventures.adventures.length, 'options');
    return adventures.adventures;
  } catch (error) {
    console.error('Error generating adventures:', error.message);
    console.error('Full response:', responseText);

    // Fallback to basic procedural generation if LLM fails
    console.log('Using fallback adventures');
    return generateFallbackAdventures(character, riskLevel);
  }
}

function generateFallbackAdventures(character, riskLevel) {
  const { current_location, level, injuries } = character;
  const injuriesArray = JSON.parse(injuries || '[]');
  const isInjured = injuriesArray.length > 0;

  const adventures = [];

  if (isInjured) {
    adventures.push({
      title: 'Seek Medical Treatment',
      description: `Find a healer or temple in ${current_location} to tend to your wounds and recover from your injuries.`,
      activity_type: 'recovery',
      estimated_game_hours: 8
    });
  }

  adventures.push({
    title: `Patrol ${current_location}`,
    description: `Scout the area around ${current_location}, looking for threats or opportunities. A routine but necessary task.`,
    activity_type: 'exploration',
    estimated_game_hours: 12
  });

  adventures.push({
    title: 'Gather Local Information',
    description: `Visit taverns and talk to locals in ${current_location}, gathering rumors and building relationships.`,
    activity_type: 'social',
    estimated_game_hours: 6
  });

  return adventures.slice(0, 3);
}

export async function generateAdventureNarrative(adventure, character, success, rewards, consequences) {
  // Parse character data for more personalization
  const skills = JSON.parse(character.skills || '[]');
  const advantages = JSON.parse(character.advantages || '[]');
  const currentQuest = character.current_quest || 'no current quest';

  // Determine pronouns based on character gender
  const gender = character.gender || 'Male';
  let pronouns;
  if (gender === 'Male') {
    pronouns = { subject: 'he', object: 'him', possessive: 'his' };
  } else if (gender === 'Female') {
    pronouns = { subject: 'she', object: 'her', possessive: 'her' };
  } else {
    pronouns = { subject: 'they', object: 'them', possessive: 'their' };
  }

  const pronounGuide = `IMPORTANT: ${character.name} is ${gender.toLowerCase()}. Use ${pronouns.subject}/${pronouns.object}/${pronouns.possessive} pronouns.`;

  const prompt = success
    ? `Write a brief D&D adventure outcome in 2-3 sentences. ${character.name} (Level ${character.level} ${character.race} ${character.class}, ${gender}) successfully completed "${adventure.title}" in ${character.current_location}.

${pronounGuide}

Focus on:
- One specific event that happened (encounter, discovery, or challenge)
- How it relates to their quest: ${currentQuest}
- Keep it straightforward and clear

Example: "${character.name} tracked cultist activity to an abandoned mill outside ${character.current_location}. Inside, ${pronouns.subject} discovered ritual markings and intercepted correspondence revealing the cult's next gathering point. The locals were grateful for ${pronouns.possessive} warning."

Write ONLY the narrative:`
    : `Write a brief D&D failure outcome in 2-3 sentences. ${character.name} (Level ${character.level} ${character.race} ${character.class}, ${gender}) failed "${adventure.title}" in ${character.current_location}.

${pronounGuide}

Focus on:
- What went wrong (ambush, trap, misinformation, etc.)
- The immediate consequence: ${consequences.map(c => c.description).join(', ')}
- Keep it clear and direct

Example: "${character.name} walked into a cultist ambush while investigating the old mill. ${pronouns.subject.charAt(0).toUpperCase() + pronouns.subject.slice(1)} barely escaped with ${pronouns.possessive} life, taking serious injuries in the process. The cult now knows someone is hunting ${pronouns.object}."

Write ONLY the narrative:`;

  try {
    console.log('Generating narrative with model:', NARRATIVE_MODEL);
    const narrative = await callOllama(prompt, NARRATIVE_MODEL, 0.7);  // Lower temperature for more coherent text

    // Clean up the response - sometimes models add extra commentary
    const cleaned = narrative
      .replace(/^(Here is|Here's|The narrative is).*?:/i, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    console.log('Generated narrative:', cleaned.substring(0, 100) + '...');
    return cleaned;
  } catch (error) {
    console.error('Error generating narrative:', error);

    // Fallback narrative with more flavor - use correct pronouns
    const subjectCap = pronouns.subject.charAt(0).toUpperCase() + pronouns.subject.slice(1);

    if (success) {
      const actions = [
        `${character.name} ventured through ${character.current_location} and encountered unexpected challenges. Through skill and determination, ${pronouns.subject} overcame the obstacles and emerged victorious, earning valuable experience and rewards.`,
        `During ${pronouns.possessive} time in ${character.current_location}, ${character.name} discovered an opportunity for adventure. ${subjectCap} quick thinking and bold action led to success, impressing locals and filling ${pronouns.possessive} coin purse.`,
        `${character.name} spent the day navigating the dangers of ${character.current_location}. When trouble found ${pronouns.object}, ${pronouns.subject} rose to the challenge and proved ${pronouns.possessive} worth as an adventurer.`
      ];
      return actions[Math.floor(Math.random() * actions.length)];
    } else {
      const failures = [
        `${character.name}'s adventure in ${character.current_location} didn't go as planned. Despite ${pronouns.possessive} best efforts, things went awry, leaving ${pronouns.object} battered and wiser from the experience.`,
        `Fortune did not favor ${character.name} this day. ${subjectCap} expedition through ${character.current_location} met with unforeseen complications, and ${pronouns.subject} was forced to retreat, licking ${pronouns.possessive} wounds.`,
        `The challenges of ${character.current_location} proved too much for ${character.name} on this occasion. ${subjectCap} survived the ordeal, but paid a price for ${pronouns.possessive} ambition.`
      ];
      return failures[Math.floor(Math.random() * failures.length)];
    }
  }
}
