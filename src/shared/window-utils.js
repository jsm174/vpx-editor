export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function setupThemeListener() {
  window.vpxEditor.onThemeChanged?.(theme => {
    document.documentElement.setAttribute('data-theme', theme);
  });
}

export function setupKeyboardShortcuts(handlers) {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && handlers.onEscape) {
      handlers.onEscape(e);
    }
    if (e.key === 'Enter' && handlers.onEnter) {
      if (handlers.requireMeta && !(e.metaKey || e.ctrlKey)) return;
      handlers.onEnter(e);
    }
  });
}

export function setupInputKeyboard(inputElement, handlers) {
  inputElement.addEventListener('keydown', e => {
    if (e.key === 'Enter' && handlers.onEnter) {
      handlers.onEnter(e);
    } else if (e.key === 'Escape' && handlers.onEscape) {
      handlers.onEscape(e);
    }
  });
}

export function createValidator(rules, config = {}) {
  return (value, existingNames = []) => {
    const trimmed = value.trim();

    for (const rule of rules) {
      switch (rule.type) {
        case 'notEmpty':
          if (!trimmed) {
            return { valid: false, error: rule.message || 'Value cannot be empty' };
          }
          break;

        case 'maxLength':
          if (trimmed.length > rule.value) {
            return { valid: false, error: rule.message || `Maximum ${rule.value} characters` };
          }
          break;

        case 'notSameAs':
          if (trimmed === rule.value) {
            return { valid: false, error: '' };
          }
          break;

        case 'notInList':
          if (existingNames.includes(trimmed) && trimmed !== config.currentValue) {
            return { valid: false, error: rule.message || 'Name already exists' };
          }
          break;

        case 'custom':
          const result = rule.validate(trimmed);
          if (!result.valid) {
            return result;
          }
          break;
      }
    }

    return { valid: true, error: '' };
  };
}

export function bindValidation(inputId, buttonId, errorId, validator, existingNames = []) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  const error = document.getElementById(errorId);

  const validate = () => {
    const result = validator(input.value, existingNames);
    button.disabled = !result.valid;
    error.textContent = result.error;
    return result.valid;
  };

  input.addEventListener('input', validate);
  return validate;
}
