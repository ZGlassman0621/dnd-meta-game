// Edit-in-wizard wrapper.
//
// The character roster + creation entry moved to client/src/components/creator/
// HomeFlow.jsx, and the prelude path was removed in the MVP reduction. This
// component now only renders the legacy CharacterCreationWizard in
// edit-existing-character mode — the CharacterSheet "Edit in Wizard" path
// (App.jsx renders it only when showCreationForm is true, which is set solely
// by handleEditInWizard). New characters are created via CharacterCreatorV2.

import CharacterCreationWizard from './CharacterCreationWizard'

function CharacterManager({
  onCharacterCreated,
  onCharacterUpdated,
  onCreationFormChange,
  editCharacterInWizard,
  onClearEditCharacter
}) {
  const finish = (char, wasEdit) => {
    if (wasEdit) {
      if (onCharacterUpdated) onCharacterUpdated(char)
    } else if (onCharacterCreated) {
      onCharacterCreated(char)
    }
    if (onClearEditCharacter) onClearEditCharacter()
    if (onCreationFormChange) onCreationFormChange(false)
  }

  return (
    <CharacterCreationWizard
      editCharacter={editCharacterInWizard}
      onCharacterCreated={(char) => finish(char, !!editCharacterInWizard)}
      onCancel={() => {
        if (onClearEditCharacter) onClearEditCharacter()
        if (onCreationFormChange) onCreationFormChange(false)
      }}
    />
  )
}

export default CharacterManager
