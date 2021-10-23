class AttackRollCheck5e {
  static MODULE_NAME = "attack-roll-check-5e";
  static MODULE_TITLE = "Attack Roll Check DnD5e";

  static init = async () => {
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
    // only do this for the user making the roll (Compatiblity with older versions of more-hooks-5e)
    if (!!userId && userId !== game.userId) return;

    if (result.options?.rollMode === 'selfRoll') {
      return;
    }

    const targetedTokens = [...(game.user.targets?.values() ?? [])].filter(t => !!t.actor);

    if (!targetedTokens.length) {
      return;
    }

    const toHitResults = targetedTokens.map((token) => this._testAttackToHit(result, token));

    const html = `
      <ul class="dnd5e chat-card check-attack-roll-list">
        ${toHitResults.map(({ token, ac, hit, isCriticalHit, isCriticalMiss }) => {
      const statusLabel = this._getStatusLabel({ hit, isCriticalHit, isCriticalMiss });

      const statusIcon = this._getStatusIcon({ hit, isCriticalHit, isCriticalMiss });

      return `
            <li class="card-header" data-token-id="${token.id}">
              <img class="token-image" src="${token.data.img}" title="${token.data.name}" width="36" height="36" style="transform: rotate(${token.data.rotation ?? 0}deg);">
              <h3>${token.data.name}</h3>
              <div class="roll-display">${result.total}</div>
              <div class="status-chip ${hit ? 'hit' : 'miss'}">
                <span>${statusLabel}</span>
                ${statusIcon}
              </div>
              <div class="ac-display">${ac}</div>
            </li>
      `}).join('')}
      </ul>
    `

    const messageData = {
      whisper: ChatMessage.getWhisperRecipients('gm'),
      blind: true,
      user: game.user.data._id,
      flags: {[this.MODULE_NAME]: { isResultCard: true }},
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      speaker: { alias: game.i18n.localize(`${this.MODULE_NAME}.MESSAGE_HEADER`) },
      content: html,
    }

    if (game.modules.get('betterrolls5e')?.active) {
      setTimeout(() => ChatMessage.create(messageData), 100);
    }

    if (game.modules.get('dice-so-nice')?.active) {
      Hooks.once('diceSoNiceRollComplete', () => {
        ChatMessage.create(messageData)
      })
    } else {
      ChatMessage.create(messageData)
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
      hit,
      ac,
    }
  }
}

Hooks.on("ready", AttackRollCheck5e.init);

/**
 * Most of this class is adapted directly from Core's handling of Combatants
 * in the combat tracker.
 */
class AttackRollCheck5eChat {
  _highlighted = null;

  /**
   * Register the chat listeners to handle hovering over names and such.
   */
  static registerChatListeners = (_chatLog, html) => {
    html.on('mouseenter', '.check-attack-roll-list > li', this._onCombatantHoverIn);
    html.on('mouseleave', '.check-attack-roll-list > li', this._onCombatantHoverOut);
    html.on('click', '.check-attack-roll-list > li', this._onCombatantMouseDown);
  }

  static _onCombatantHoverIn = (event) => {
    event.preventDefault();

    if (!canvas.ready) return;
    const li = event.currentTarget;
    const token = canvas.tokens.get(li.dataset.tokenId);
    if (token?.isVisible) {
      if (!token._controlled) token._onHoverIn(event);
      this._highlighted = token;
    }
  }

  static _onCombatantHoverOut = (event) => {
    event.preventDefault();
    if (!canvas.ready) return;

    if (this._highlighted) this._highlighted._onHoverOut(event);
    this._highlighted = null;
  }

  static _onCombatantMouseDown = async (event) => {
    event.preventDefault();

    const li = event.currentTarget;
    const token = canvas.tokens.get(li.dataset.tokenId);
    if (!token?.actor?.testUserPermission(game.user, "OBSERVED")) return;
    const now = Date.now();

    // Handle double-left click to open sheet
    const dt = now - this._clickTime;
    this._clickTime = now;
    if (dt <= 250) {
      if (token.actor) token.actor.sheet.render(true);
    }

    if (!canvas.ready) return;

    // Control and pan on single-left
    else {
      token.control({ releaseOthers: true });
    }
  }

  /**
   * Removes the messages for players which are meant to be blind.
   */
  static removeMessagesForPlayers = (message, html) => {
    if (game.user.isGM) return;

    if (message.getFlag(AttackRollCheck5e.MODULE_NAME, 'isResultCard')) {
      html.addClass('attack-roll-check-5e-remove-blind');
    }
  }

}

Hooks.on('renderChatLog', AttackRollCheck5eChat.registerChatListeners);

Hooks.on('renderChatMessage', AttackRollCheck5eChat.removeMessagesForPlayers);