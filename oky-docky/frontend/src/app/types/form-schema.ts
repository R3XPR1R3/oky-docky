/**
 * FORM SCHEMA TYPES
 * 
 * This file defines the structure for dynamic forms that are loaded from the backend.
 * All forms are defined in JSON format and rendered dynamically by the frontend.
 */

export type FieldType = 
  | 'text' 
  | 'email' 
  | 'password' 
  | 'number' 
  | 'textarea' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'date'
  | 'file';

export interface FieldOption {
  label: string;
  value: string;
}

export interface ConditionalRule {
  field: string;          // Field ID to watch
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
  value: string | number | boolean;
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'email';
  value?: string | number;
  message: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string | number | boolean;
  options?: FieldOption[];      // For select, radio
  validations?: ValidationRule[];
  conditional?: ConditionalRule; // Show field only if condition is met
  grid?: {                       // Layout hints
    colSpan?: 1 | 2 | 3;        // How many columns to span
  };
}

export interface FormStep {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
}

export interface FormDefinition {
  id: string;
  title: string;
  description: string;
  version: string;
  steps: FormStep[];
  metadata?: {
    category?: string[];
    format?: string[];
    estimatedTime?: string;
    requiredDocuments?: string[];
  };
}

export interface FormSubmission {
  formId: string;
  formVersion: string;
  data: Record<string, any>;
  submittedAt: string;
}
