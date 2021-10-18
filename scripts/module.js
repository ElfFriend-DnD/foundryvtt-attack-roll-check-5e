class AttackRollCheck5e {
  MODULE_NAME = "attack-roll-check-5e";
  MODULE_TITLE = "Attack Roll Check D&D5e";


  static init() {
    console.log(`${MODULE_NAME} | Initializing ${MODULE_TITLE}`);

    Hooks.on('Item5e.rollAttack', this._checkAttackRoll);
  }
  

  static _checkAttackRoll(_item, result, _config, _actor, { userId } = {}) {
    const targetedTokens = [...(game.users.get(userId)?.targets?.values() ?? [])].filter(t => !!t.actor);

    if (!targetedTokens.length) {
      return;
    }

    const toHitResults = targetedTokens.map((token) => _testAttackToHit(result, token));

    const html = `
    <ul>
      ${toHitResults.map(({ token, hit }) => {
      return `<li>
        <img src="${token.data.img}" title="${token.data.name}" width="36" height="36">
        ${hit ? 'Hit' : 'Miss'}
        </li>`
    })}
    </ul>
  `

    if (game.modules.get('dice-so-nice').active) {
      Hooks.once('diceSoNiceRollComplete', (chatMessageId) => {
        ChatMessage.create({
          whisper: ChatMessage.getWhisperRecipients('gm'),
          user: game.user.data._id,
          type: CONST.CHAT_MESSAGE_TYPES.OTHER,
          content: html,
          blind: true,
        })
      })
    } else {
      ChatMessage.create({
        whisper: ChatMessage.getWhisperRecipients('gm'),
        user: game.user.data._id,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        content: html,
        blind: true,
      })
    }
  } 

  static _testAttackToHit(roll, token) {
    const ac = token.actor.data.data.attributes.ac.value;
    const d20 = roll.dice[0];

    const isCritical = (d20.faces === 20) && (d20.values.length === 1) && (d20.total >= (d20.options.critical ?? 20));

    const hit = isCritical || ac <= roll.total;

    return {
      token,
      hit
    }
  }
}

Hooks.on("ready", async () => {
  AttackRollCheck5e.init();
});
