class AttackRollCheck5e {
  static MODULE_NAME = "attack-roll-check-5e";
  static MODULE_TITLE = "Attack Roll Check D&D5e";


  static init() {
    console.log(`${this.MODULE_NAME} | Initializing ${this.MODULE_TITLE}`);

    Hooks.on('Item5e.rollAttack', this._checkAttackRoll);
  }

  static _getStatusIcon = ({ hit, isCriticalHit, isCriticalMiss }) => {
    switch (true) {
      case isCriticalMiss:
        return '<i class="fas fa-thumbs-down"></i>';
      case isCriticalHit:
        return '<i class="fas fa-check-double"></i>';
      default:
        return hit ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>';
    }
  }

  static _getStatusLabel = ({ hit, isCriticalHit, isCriticalMiss }) => {
    switch (true) {
      case isCriticalMiss:
        return game.i18n.localize(`${this.MODULE_NAME}.FUMBLE`);
      case isCriticalHit:
        return game.i18n.localize(`${this.MODULE_NAME}.CRITICAL`);
      default:
        return hit ? game.i18n.localize(`${this.MODULE_NAME}.HIT`) : game.i18n.localize(`${this.MODULE_NAME}.MISS`);
    }
  }

  static _checkAttackRoll = (_item, result, _config, _actor, { userId } = {}) => {
    // debugger;
    if (!game.user.isGM) {
      return;
    }


    if (result.options?.rollMode === 'selfRoll' && userId !== game.user.id) {
      return;
    }

    const targetedTokens = [...(game.users.get(userId)?.targets?.values() ?? [])].filter(t => !!t.actor);

    if (!targetedTokens.length) {
      return;
    }

    const toHitResults = targetedTokens.map((token) => this._testAttackToHit(result, token));


    const html = `
      <ul class="dnd5e chat-card check-attack-roll-list">
        ${toHitResults.map(({ token, hit, isCriticalHit, isCriticalMiss }) => {
          const statusLabel = this._getStatusLabel({ hit, isCriticalHit, isCriticalMiss });

          const statusIcon = this._getStatusIcon({ hit, isCriticalHit, isCriticalMiss });

          return `
            <li class="card-header">
              <img class="token-image" src="${token.data.img}" title="${token.data.name}" width="36" height="36">
              <h3>${token.data.name}</h3>
              <div class="roll-display">${result.total}</div>
              <div class="status-chip ${hit ? 'hit' : 'miss'}">
                <span>${statusLabel}</span>
                ${statusIcon}
              </div>
              <div class="ac-display">${token.actor?.data.data.attributes.ac.value}</div>
            </li>
      `}).join('')}
      </ul>
    `

    if (game.modules.get('dice-so-nice').active) {
      Hooks.once('diceSoNiceRollComplete', (chatMessageId) => {
        ChatMessage.create({
          whisper: ChatMessage.getWhisperRecipients('gm'),
          user: game.user.data._id,
          type: CONST.CHAT_MESSAGE_TYPES.OTHER,
          speaker: { alias: game.i18n.localize(`${this.MODULE_NAME}.MESSAGE_HEADER`)},
          content: html,
        })
      })
    } else {
      ChatMessage.create({
        whisper: ChatMessage.getWhisperRecipients('gm'),
        user: game.user.data._id,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        speaker: { alias: game.i18n.localize(`${this.MODULE_NAME}.MESSAGE_HEADER`)},
        content: html,
      })
    }
  }

  static _onCombatantHoverIn(event) {
    event.preventDefault();
    if (!canvas.ready) return;
    const li = event.currentTarget;
    const combatant = this.viewed.combatants.get(li.dataset.combatantId);
    const token = combatant.token?.object;
    if (token?.isVisible) {
      if (!token._controlled) token._onHoverIn(event);
      this._highlighted = token;
    }
  }

  static _testAttackToHit = (roll, token) => {
    const ac = token.actor.data.data.attributes.ac.value;
    const d20 = roll.dice[0];

    const isCriticalHit = (d20.faces === 20) && (d20.values.length === 1) && (d20.total >= (d20.options.critical ?? 20));
    const isCriticalMiss = (d20.faces === 20) && (d20.values.length === 1) && (d20.total === 1);

    const hit = !isCriticalMiss && (isCriticalHit || ac <= roll.total);

    return {
      token,
      isCriticalMiss,
      isCriticalHit,
      hit
    }
  }
}

Hooks.on("ready", async () => {
  AttackRollCheck5e.init();
});
