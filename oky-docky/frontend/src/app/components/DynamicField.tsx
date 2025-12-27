import { FormField } from '../types/form-schema';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface DynamicFieldProps {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}

export function DynamicField({ field, value, onChange, error }: DynamicFieldProps) {
  const colSpan = field.grid?.colSpan || 3;
  const colSpanClass =
    colSpan === 1 ? 'col-span-1' : colSpan === 2 ? 'col-span-2' : 'col-span-3';

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
        return (
          <Input
            id={field.id}
            type={field.type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={`rounded-lg border-2 bg-gray-50/50 shadow-inner transition-all focus:bg-white ${
              error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
          />
        );

      case 'textarea':
        return (
          <Textarea
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={`rounded-lg border-2 bg-gray-50/50 shadow-inner transition-all focus:bg-white ${
              error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
          />
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger
              className={`rounded-lg border-2 bg-gray-50/50 shadow-inner ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
            >
              <SelectValue placeholder={field.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup value={value || ''} onValueChange={onChange}>
            <div className="space-y-3">
              {field.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`${field.id}-${option.value}`} />
                  <Label
                    htmlFor={`${field.id}-${option.value}`}
                    className="cursor-pointer font-normal text-gray-700"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <div className="flex items-start space-x-2">
            <Checkbox
              id={field.id}
              checked={value || false}
              onCheckedChange={onChange}
              className={error ? 'border-red-500' : ''}
            />
            <Label
              htmlFor={field.id}
              className="cursor-pointer font-normal leading-tight text-gray-700"
            >
              {field.label}
            </Label>
          </div>
        );

      case 'date':
        return (
          <Input
            id={field.id}
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`rounded-lg border-2 bg-gray-50/50 shadow-inner transition-all focus:bg-white ${
              error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
            style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)' }}
          />
        );

      case 'file':
        return (
          <Input
            id={field.id}
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              onChange(file);
            }}
            className={`rounded-lg border-2 bg-gray-50/50 shadow-inner transition-all focus:bg-white ${
              error ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
            }`}
          />
        );

      default:
        return null;
    }
  };

  // For checkbox, render differently (no separate label)
  if (field.type === 'checkbox') {
    return (
      <div className={colSpanClass}>
        <div
          className={`rounded-lg border-2 bg-blue-50/50 p-4 ${
            error ? 'border-red-300' : 'border-blue-200'
          }`}
        >
          {renderField()}
          {field.helpText && (
            <p className="ml-6 mt-1 text-xs text-gray-500">{field.helpText}</p>
          )}
          {error && <p className="ml-6 mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={colSpanClass}>
      <div className="space-y-2">
        <Label htmlFor={field.id} className="font-medium text-gray-700">
          {field.label}
          {field.validations?.some((v) => v.type === 'required') && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </Label>
        {renderField()}
        {field.helpText && (
          <p className="text-xs text-gray-500">{field.helpText}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
