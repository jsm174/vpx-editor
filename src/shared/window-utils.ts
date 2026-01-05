export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function setupThemeListener(): void {
  window.vpxEditor.onThemeChanged?.((theme: string) => {
    document.documentElement.setAttribute('data-theme', theme);
  });
}

export interface KeyboardHandlers {
  onEscape?: (e: KeyboardEvent) => void;
  onEnter?: (e: KeyboardEvent) => void;
  requireMeta?: boolean;
}

export function setupKeyboardShortcuts(handlers: KeyboardHandlers): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && handlers.onEscape) {
      handlers.onEscape(e);
    }
    if (e.key === 'Enter' && handlers.onEnter) {
      if (handlers.requireMeta && !(e.metaKey || e.ctrlKey)) return;
      handlers.onEnter(e);
    }
  });
}

export interface InputHandlers {
  onEnter?: (e: KeyboardEvent) => void;
  onEscape?: (e: KeyboardEvent) => void;
}

export function setupInputKeyboard(inputElement: HTMLElement, handlers: InputHandlers): void {
  inputElement.addEventListener('keydown', (e: Event) => {
    const keyEvent = e as KeyboardEvent;
    if (keyEvent.key === 'Enter' && handlers.onEnter) {
      handlers.onEnter(keyEvent);
    } else if (keyEvent.key === 'Escape' && handlers.onEscape) {
      handlers.onEscape(keyEvent);
    }
  });
}

export interface ValidationResult {
  valid: boolean;
  error: string;
}

export interface ValidationRule {
  type: 'notEmpty' | 'maxLength' | 'notSameAs' | 'notInList' | 'custom';
  value?: string | number;
  message?: string;
  validate?: (value: string) => ValidationResult;
}

export interface ValidatorConfig {
  currentValue?: string;
}

export type Validator = (value: string, existingNames?: string[]) => ValidationResult;

export function createValidator(rules: ValidationRule[], config: ValidatorConfig = {}): Validator {
  return (value: string, existingNames: string[] = []): ValidationResult => {
    const trimmed = value.trim();

    for (const rule of rules) {
      switch (rule.type) {
        case 'notEmpty':
          if (!trimmed) {
            return { valid: false, error: rule.message || 'Value cannot be empty' };
          }
          break;

        case 'maxLength':
          if (typeof rule.value === 'number' && trimmed.length > rule.value) {
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
          if (rule.validate) {
            const result = rule.validate(trimmed);
            if (!result.valid) {
              return result;
            }
          }
          break;
      }
    }

    return { valid: true, error: '' };
  };
}

export function bindValidation(
  inputId: string,
  buttonId: string,
  errorId: string,
  validator: Validator,
  existingNames: string[] = []
): () => boolean {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const button = document.getElementById(buttonId) as HTMLButtonElement;
  const error = document.getElementById(errorId) as HTMLElement;

  const validate = (): boolean => {
    const result = validator(input.value, existingNames);
    button.disabled = !result.valid;
    error.textContent = result.error;
    return result.valid;
  };

  input.addEventListener('input', validate);
  return validate;
}
