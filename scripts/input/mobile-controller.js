/**
 * Minimal mobile input layer for the first combat test.
 *
 * This is presentation/input only. It does not own character state or damage.
 * The left touch area behaves as a virtual joystick and the right button emits
 * a BASIC_ATTACK request. Keyboard and mouse input remain available for desktop testing.
 */

const HAVOC_MOBILE_INPUT_CONFIG = {
  uiLayer: 'UI',
  joystickBase: 'MobileJoystickBase',
  joystickKnob: 'MobileJoystickKnob',
  attackButton: 'MobileAttackButton',
  joystickRadius: 90,
  joystickCenterX: 120,
  joystickBottomMargin: 115,
  attackButtonWidth: 190,
  attackButtonHeight: 80,
  attackButtonRightMargin: 45,
  attackButtonBottomMargin: 45,
};

function initializeHavocMobileInput(runtimeScene) {
  if (!runtimeScene.__havocMobileInput) {
    runtimeScene.__havocMobileInput = {
      joystickTouchId: null,
      joystickActive: false,
      joystickMouseActive: false,
      moveX: 0,
      moveY: 0,
      run: false,
      attackRequested: false,
      targetTapX: null,
      targetTapY: null,
      targetTapRequested: false,
      mouseLeftWasPressed: false,
    };
  }

  return runtimeScene.__havocMobileInput;
}

function updateHavocMobileInput(runtimeScene) {
  const state = initializeHavocMobileInput(runtimeScene);
  const game = runtimeScene.getGame();
  const inputManager = game.getInputManager();
  const width = runtimeScene.getViewportWidth();
  const height = runtimeScene.getViewportHeight();

  state.attackRequested = false;
  state.targetTapRequested = false;

  const uiLayer = runtimeScene.getLayer(HAVOC_MOBILE_INPUT_CONFIG.uiLayer);
  const joystickBase = runtimeScene.getObjects(HAVOC_MOBILE_INPUT_CONFIG.joystickBase)[0];
  const joystickKnob = runtimeScene.getObjects(HAVOC_MOBILE_INPUT_CONFIG.joystickKnob)[0];
  const attackButton = runtimeScene.getObjects(HAVOC_MOBILE_INPUT_CONFIG.attackButton)[0];

  const joystickCenterX = HAVOC_MOBILE_INPUT_CONFIG.joystickCenterX;
  const joystickCenterY = height - HAVOC_MOBILE_INPUT_CONFIG.joystickBottomMargin;
  const attackLeft = width - HAVOC_MOBILE_INPUT_CONFIG.attackButtonRightMargin - HAVOC_MOBILE_INPUT_CONFIG.attackButtonWidth;
  const attackTop = height - HAVOC_MOBILE_INPUT_CONFIG.attackButtonBottomMargin - HAVOC_MOBILE_INPUT_CONFIG.attackButtonHeight;

  if (uiLayer) {
    if (joystickBase) {
      joystickBase.setPosition(
        joystickCenterX - (joystickBase.getWidth() || 72) / 2,
        joystickCenterY - (joystickBase.getHeight() || 72) / 2
      );
    }
    if (attackButton) {
      attackButton.setPosition(attackLeft, attackTop);
    }
  }

  // Hit testing uses canvas pixel coordinates (0 to viewportWidth, 0 to viewportHeight).
  const isInsideAttackButton = (x, y) =>
    x >= attackLeft &&
    x <= attackLeft + HAVOC_MOBILE_INPUT_CONFIG.attackButtonWidth &&
    y >= attackTop &&
    y <= attackTop + HAVOC_MOBILE_INPUT_CONFIG.attackButtonHeight;

  const isInJoystickRegion = (x, y) =>
    x <= width * 0.42 && y >= height * 0.55;

  // Desktop mouse handling
  const mouseLeftPressed = inputManager.isMouseButtonPressed(gdjs.InputManager.MOUSE_LEFT_BUTTON);
  const mouseLeftStarted = mouseLeftPressed && !state.mouseLeftWasPressed;
  state.mouseLeftWasPressed = mouseLeftPressed;

  const mouseX = inputManager.getCursorX();
  const mouseY = inputManager.getCursorY();

  if (mouseLeftStarted) {
    if (isInsideAttackButton(mouseX, mouseY)) {
      state.attackRequested = true;
    } else if (isInJoystickRegion(mouseX, mouseY)) {
      state.joystickMouseActive = true;
    } else {
      state.targetTapX = mouseX;
      state.targetTapY = mouseY;
      state.targetTapRequested = true;
    }
  }

  if (state.joystickMouseActive) {
    if (!mouseLeftPressed) {
      state.joystickMouseActive = false;
      if (state.joystickTouchId === null) {
        state.joystickActive = false;
        state.moveX = 0;
        state.moveY = 0;
        state.run = false;
      }
    } else {
      const dx = mouseX - joystickCenterX;
      const dy = mouseY - joystickCenterY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const clampedLength = Math.min(length, HAVOC_MOBILE_INPUT_CONFIG.joystickRadius);
      const nx = length > 0 ? dx / length : 0;
      const ny = length > 0 ? dy / length : 0;

      state.moveX = nx * (clampedLength / HAVOC_MOBILE_INPUT_CONFIG.joystickRadius);
      state.moveY = -ny * (clampedLength / HAVOC_MOBILE_INPUT_CONFIG.joystickRadius);
      state.run = clampedLength >= HAVOC_MOBILE_INPUT_CONFIG.joystickRadius * 0.78;
      state.joystickActive = true;

      if (joystickKnob) {
        joystickKnob.setPosition(
          joystickCenterX + nx * clampedLength - (joystickKnob.getWidth() || 36) / 2,
          joystickCenterY + ny * clampedLength - (joystickKnob.getHeight() || 36) / 2
        );
      }
    }
  }

  // Mobile touch handling
  const touchIds = inputManager.getAllTouchIdentifiers();
  const startedIds = inputManager.getStartedTouchIdentifiers();

  for (const id of startedIds) {
    if (typeof gdjs.InputManager.MOUSE_TOUCH_ID !== 'undefined' && id === gdjs.InputManager.MOUSE_TOUCH_ID) {
      continue;
    }

    const x = inputManager.getTouchX(id);
    const y = inputManager.getTouchY(id);

    if (isInsideAttackButton(x, y)) {
      state.attackRequested = true;
      continue;
    }

    if (isInJoystickRegion(x, y) && state.joystickTouchId === null) {
      state.joystickTouchId = id;
      state.joystickActive = true;
      continue;
    }

    state.targetTapX = x;
    state.targetTapY = y;
    state.targetTapRequested = true;
  }

  if (state.joystickTouchId !== null) {
    const id = state.joystickTouchId;
    if (touchIds.indexOf(id) === -1) {
      state.joystickTouchId = null;
      if (!state.joystickMouseActive) {
        state.joystickActive = false;
        state.moveX = 0;
        state.moveY = 0;
        state.run = false;
      }
    } else {
      const x = inputManager.getTouchX(id);
      const y = inputManager.getTouchY(id);
      const dx = x - joystickCenterX;
      const dy = y - joystickCenterY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const clampedLength = Math.min(length, HAVOC_MOBILE_INPUT_CONFIG.joystickRadius);
      const nx = length > 0 ? dx / length : 0;
      const ny = length > 0 ? dy / length : 0;

      state.moveX = nx * (clampedLength / HAVOC_MOBILE_INPUT_CONFIG.joystickRadius);
      state.moveY = -ny * (clampedLength / HAVOC_MOBILE_INPUT_CONFIG.joystickRadius);
      state.run = clampedLength >= HAVOC_MOBILE_INPUT_CONFIG.joystickRadius * 0.78;
      state.joystickActive = true;

      if (joystickKnob) {
        joystickKnob.setPosition(
          joystickCenterX + nx * clampedLength - (joystickKnob.getWidth() || 36) / 2,
          joystickCenterY + ny * clampedLength - (joystickKnob.getHeight() || 36) / 2
        );
      }
    }
  }

  if (!state.joystickActive && joystickKnob) {
    joystickKnob.setPosition(
      joystickCenterX - (joystickKnob.getWidth() || 36) / 2,
      joystickCenterY - (joystickKnob.getHeight() || 36) / 2
    );
  }

  if (gdjs.evtTools.input.wasKeyJustPressed(runtimeScene, 'space')) {
    state.attackRequested = true;
  }
}
