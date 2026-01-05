import {
  setupThemeListener,
  createValidator,
  bindValidation,
  setupInputKeyboard,
  ValidationRule,
  Validator,
} from '../../shared/window-utils.js';

interface PromptConfig {
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  existingNames?: string[];
  emptyError?: string;
  existsError?: string;
  maxLength?: number;
  currentValue?: string;
}

let config: PromptConfig = {};
let existingNames: string[] = [];
let validate: (() => boolean) | undefined;

setupThemeListener();

window.vpxEditor.onInitPrompt?.((data: PromptConfig) => {
  config = data;
  existingNames = data.existingNames || [];

  (document.getElementById('prompt-label') as HTMLElement).textContent = data.label || '';

  const input = document.getElementById('prompt-input') as HTMLInputElement;
  input.value = data.defaultValue || '';
  input.placeholder = data.placeholder || '';
  input.focus();
  input.select();

  const rules: ValidationRule[] = [{ type: 'notEmpty', message: config.emptyError || 'Value cannot be empty' }];
  if (config.maxLength) {
    rules.push({ type: 'maxLength', value: config.maxLength });
  }
  if (config.currentValue) {
    rules.push({ type: 'notSameAs', value: config.currentValue });
  }
  rules.push({ type: 'notInList', message: config.existsError || 'Name already exists' });

  const validator: Validator = createValidator(rules, { currentValue: config.currentValue });
  validate = bindValidation('prompt-input', 'prompt-ok', 'prompt-error', validator, existingNames);
  validate();
});

const submit = (): void => {
  if (validate && validate()) {
    window.vpxEditor.promptResult((document.getElementById('prompt-input') as HTMLInputElement).value.trim());
  }
};

const cancel = (): void => {
  window.vpxEditor.promptResult(null);
};

(document.getElementById('prompt-cancel') as HTMLButtonElement).addEventListener('click', cancel);
(document.getElementById('prompt-ok') as HTMLButtonElement).addEventListener('click', submit);

setupInputKeyboard(document.getElementById('prompt-input') as HTMLInputElement, {
  onEnter: submit,
  onEscape: cancel,
});
