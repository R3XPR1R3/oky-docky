/**
 * MOCK API SERVICE
 * 
 * This file simulates backend API calls. In production, replace these with
 * actual FastAPI endpoint calls using fetch or axios.
 * 
 * FastAPI Endpoints to implement:
 * - GET /api/documents - List all available documents
 * - GET /api/documents/{id} - Get document details
 * - GET /api/forms/{id} - Get form definition with fields
 * - POST /api/forms/{id}/submit - Submit filled form data
 * - GET /api/forms/{id}/preview - Get PDF preview URL
 */

import { Document } from '../data/documents';
import { FormDefinition } from '../types/form-schema';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API Base URL - Replace with your FastAPI backend URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

/**
 * Fetch all available documents from backend
 */
export async function fetchDocuments(): Promise<Document[]> {
  await delay(500); // Simulate network delay
  
  // In production, use:
  // const response = await fetch(`${API_BASE_URL}/documents`);
  // return response.json();
  
  return [
    {
      id: 'w9',
      title: 'IRS W-9 Tax Form',
      description: 'Request for Taxpayer Identification Number and Certification',
      category: ['Tax', 'Business'],
      format: ['PDF', 'Online'],
      status: 'available',
      badge: 'popular',
      isFavorite: false,
    },
    {
      id: 'i9',
      title: 'Form I-9',
      description: 'Employment Eligibility Verification',
      category: ['Immigration', 'Business'],
      format: ['PDF', 'DOCX'],
      status: 'available',
      badge: 'new',
      isFavorite: false,
    },
    {
      id: '1040',
      title: 'Form 1040',
      description: 'U.S. Individual Income Tax Return',
      category: ['Tax'],
      format: ['PDF', 'Online'],
      status: 'available',
      badge: 'popular',
      isFavorite: false,
    },
    {
      id: 'llc-formation',
      title: 'LLC Formation Documents',
      description: 'Articles of Organization and Operating Agreement',
      category: ['Business', 'Legal'],
      format: ['DOCX', 'PDF'],
      status: 'available',
      isFavorite: false,
    },
    {
      id: 'power-of-attorney',
      title: 'Power of Attorney',
      description: 'General durable power of attorney form',
      category: ['Legal', 'Notary'],
      format: ['PDF', 'DOCX'],
      status: 'available',
      badge: 'updated',
      isFavorite: false,
    },
    {
      id: 'nda',
      title: 'Non-Disclosure Agreement',
      description: 'Mutual confidentiality agreement for business',
      category: ['Business', 'Legal'],
      format: ['DOCX', 'Online'],
      status: 'available',
      isFavorite: false,
    },
  ];
}

/**
 * Fetch form definition by ID from backend
 */
export async function fetchFormDefinition(formId: string): Promise<FormDefinition> {
  await delay(800); // Simulate network delay
  
  // In production, use:
  // const response = await fetch(`${API_BASE_URL}/forms/${formId}`);
  // return response.json();
  
  // Return form definitions based on formId
  return getFormDefinitionById(formId);
}

/**
 * Submit form data to backend
 */
export async function submitForm(formId: string, data: Record<string, any>): Promise<{
  success: boolean;
  submissionId: string;
  pdfUrl?: string;
  message: string;
}> {
  await delay(1000); // Simulate network delay
  
  // In production, use:
  // const response = await fetch(`${API_BASE_URL}/forms/${formId}/submit`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data)
  // });
  // return response.json();
  
  return {
    success: true,
    submissionId: `SUB-${Date.now()}`,
    pdfUrl: '/mock-generated-form.pdf',
    message: 'Form submitted successfully!',
  };
}

/**
 * Get form definition by ID
 * This contains all the form definitions that the backend would return
 */
function getFormDefinitionById(formId: string): FormDefinition {
  const formDefinitions: Record<string, FormDefinition> = {
    'w9': {
      id: 'w9',
      title: 'IRS W-9 Tax Form',
      description: 'Request for Taxpayer Identification Number and Certification',
      version: '1.0.0',
      metadata: {
        category: ['Tax', 'Business'],
        format: ['PDF', 'Online'],
        estimatedTime: '10 minutes',
        requiredDocuments: ['Social Security Number or EIN'],
      },
      steps: [
        {
          id: 'step-1',
          title: 'Personal Information',
          description: 'Enter your personal details as they appear on your tax documents',
          fields: [
            {
              id: 'name',
              type: 'text',
              label: 'Full Name (as shown on your income tax return)',
              placeholder: 'John Doe',
              helpText: 'Enter your legal name exactly as it appears on your tax return',
              validations: [
                { type: 'required', message: 'Name is required' },
                { type: 'minLength', value: 2, message: 'Name must be at least 2 characters' },
              ],
            },
            {
              id: 'businessName',
              type: 'text',
              label: 'Business Name / Disregarded Entity Name',
              placeholder: 'Acme Corporation',
              helpText: 'If different from name above',
            },
            {
              id: 'address',
              type: 'text',
              label: 'Street Address',
              placeholder: '123 Main Street',
              validations: [
                { type: 'required', message: 'Address is required' },
              ],
            },
            {
              id: 'city',
              type: 'text',
              label: 'City',
              placeholder: 'New York',
              grid: { colSpan: 2 },
              validations: [
                { type: 'required', message: 'City is required' },
              ],
            },
            {
              id: 'state',
              type: 'text',
              label: 'State',
              placeholder: 'NY',
              grid: { colSpan: 1 },
              validations: [
                { type: 'required', message: 'State is required' },
                { type: 'maxLength', value: 2, message: 'Use 2-letter state code' },
              ],
            },
            {
              id: 'zip',
              type: 'text',
              label: 'ZIP Code',
              placeholder: '10001',
              validations: [
                { type: 'required', message: 'ZIP code is required' },
                { type: 'pattern', value: '^\\d{5}$', message: 'Must be 5 digits' },
              ],
            },
          ],
        },
        {
          id: 'step-2',
          title: 'Tax Classification',
          description: 'Select your federal tax classification',
          fields: [
            {
              id: 'taxClassification',
              type: 'radio',
              label: 'Federal Tax Classification',
              helpText: 'Check the box that applies to you',
              options: [
                { label: 'Individual / Sole Proprietor or Single-member LLC', value: 'individual' },
                { label: 'C Corporation', value: 'c-corp' },
                { label: 'S Corporation', value: 's-corp' },
                { label: 'Partnership', value: 'partnership' },
                { label: 'Trust / Estate', value: 'trust' },
                { label: 'Limited Liability Company', value: 'llc' },
              ],
              validations: [
                { type: 'required', message: 'Tax classification is required' },
              ],
            },
            {
              id: 'llcClassification',
              type: 'select',
              label: 'LLC Tax Classification',
              helpText: 'If LLC, select how you want to be taxed',
              options: [
                { label: 'C Corporation', value: 'c' },
                { label: 'S Corporation', value: 's' },
                { label: 'Partnership', value: 'p' },
              ],
              conditional: {
                field: 'taxClassification',
                operator: 'equals',
                value: 'llc',
              },
              validations: [
                { type: 'required', message: 'LLC classification is required' },
              ],
            },
            {
              id: 'exemptPayeeCode',
              type: 'text',
              label: 'Exempt Payee Code (if any)',
              placeholder: 'Enter code',
              helpText: 'Leave blank if not applicable',
            },
          ],
        },
        {
          id: 'step-3',
          title: 'Taxpayer Identification',
          description: 'Provide your taxpayer identification number',
          fields: [
            {
              id: 'tinType',
              type: 'radio',
              label: 'Taxpayer Identification Number Type',
              options: [
                { label: 'Social Security Number (SSN)', value: 'ssn' },
                { label: 'Employer Identification Number (EIN)', value: 'ein' },
              ],
              validations: [
                { type: 'required', message: 'TIN type is required' },
              ],
            },
            {
              id: 'ssn',
              type: 'password',
              label: 'Social Security Number',
              placeholder: 'XXX-XX-XXXX',
              helpText: 'Your 9-digit SSN',
              conditional: {
                field: 'tinType',
                operator: 'equals',
                value: 'ssn',
              },
              validations: [
                { type: 'required', message: 'SSN is required' },
                { type: 'pattern', value: '^\\d{3}-?\\d{2}-?\\d{4}$', message: 'Invalid SSN format' },
              ],
            },
            {
              id: 'ein',
              type: 'text',
              label: 'Employer Identification Number',
              placeholder: 'XX-XXXXXXX',
              helpText: 'Your 9-digit EIN',
              conditional: {
                field: 'tinType',
                operator: 'equals',
                value: 'ein',
              },
              validations: [
                { type: 'required', message: 'EIN is required' },
                { type: 'pattern', value: '^\\d{2}-?\\d{7}$', message: 'Invalid EIN format' },
              ],
            },
          ],
        },
        {
          id: 'step-4',
          title: 'Certification',
          description: 'Review and certify your information',
          fields: [
            {
              id: 'certify',
              type: 'checkbox',
              label: 'I certify that the information provided is true, correct, and complete',
              validations: [
                { type: 'required', message: 'You must certify to continue' },
              ],
            },
            {
              id: 'certifyPerjury',
              type: 'checkbox',
              label: 'I certify under penalties of perjury that the information is correct',
              validations: [
                { type: 'required', message: 'You must certify under penalties of perjury' },
              ],
            },
            {
              id: 'signatureDate',
              type: 'date',
              label: 'Signature Date',
              defaultValue: new Date().toISOString().split('T')[0],
              validations: [
                { type: 'required', message: 'Date is required' },
              ],
            },
          ],
        },
      ],
    },
    'i9': {
      id: 'i9',
      title: 'Form I-9',
      description: 'Employment Eligibility Verification',
      version: '1.0.0',
      metadata: {
        category: ['Immigration', 'Business'],
        format: ['PDF', 'DOCX'],
        estimatedTime: '15 minutes',
        requiredDocuments: ['Valid ID', 'Work Authorization Documents'],
      },
      steps: [
        {
          id: 'step-1',
          title: 'Employee Information',
          description: 'Section 1: Employee Information and Attestation',
          fields: [
            {
              id: 'lastName',
              type: 'text',
              label: 'Last Name (Family Name)',
              validations: [{ type: 'required', message: 'Last name is required' }],
            },
            {
              id: 'firstName',
              type: 'text',
              label: 'First Name (Given Name)',
              validations: [{ type: 'required', message: 'First name is required' }],
            },
            {
              id: 'middleInitial',
              type: 'text',
              label: 'Middle Initial',
            },
            {
              id: 'otherNames',
              type: 'text',
              label: 'Other Last Names Used (if any)',
              helpText: 'Include maiden name or previous names',
            },
            {
              id: 'address',
              type: 'text',
              label: 'Street Address',
              validations: [{ type: 'required', message: 'Address is required' }],
            },
            {
              id: 'city',
              type: 'text',
              label: 'City or Town',
              grid: { colSpan: 2 },
              validations: [{ type: 'required', message: 'City is required' }],
            },
            {
              id: 'state',
              type: 'text',
              label: 'State',
              grid: { colSpan: 1 },
              validations: [{ type: 'required', message: 'State is required' }],
            },
            {
              id: 'zipCode',
              type: 'text',
              label: 'ZIP Code',
              validations: [
                { type: 'required', message: 'ZIP code is required' },
                { type: 'pattern', value: '^\\d{5}$', message: 'Must be 5 digits' },
              ],
            },
            {
              id: 'dateOfBirth',
              type: 'date',
              label: 'Date of Birth',
              validations: [{ type: 'required', message: 'Date of birth is required' }],
            },
            {
              id: 'ssnLast4',
              type: 'password',
              label: 'Last 4 digits of Social Security Number',
              placeholder: 'XXXX',
              validations: [
                { type: 'required', message: 'SSN last 4 digits required' },
                { type: 'pattern', value: '^\\d{4}$', message: 'Must be 4 digits' },
              ],
            },
            {
              id: 'email',
              type: 'email',
              label: 'Email Address',
              validations: [
                { type: 'required', message: 'Email is required' },
                { type: 'email', message: 'Invalid email format' },
              ],
            },
            {
              id: 'phoneNumber',
              type: 'text',
              label: 'Telephone Number',
              placeholder: '(555) 123-4567',
              validations: [{ type: 'required', message: 'Phone number is required' }],
            },
          ],
        },
        {
          id: 'step-2',
          title: 'Citizenship / Immigration Status',
          description: 'Attest to your citizenship or immigration status',
          fields: [
            {
              id: 'citizenshipStatus',
              type: 'radio',
              label: 'I attest that I am:',
              options: [
                { label: 'A citizen of the United States', value: 'citizen' },
                { label: 'A noncitizen national of the United States', value: 'national' },
                { label: 'A lawful permanent resident', value: 'lpr' },
                { label: 'An alien authorized to work', value: 'authorized' },
              ],
              validations: [{ type: 'required', message: 'Citizenship status is required' }],
            },
            {
              id: 'uscisNumber',
              type: 'text',
              label: 'USCIS Number',
              placeholder: 'A12345678 or 123-456-789',
              helpText: 'Alien Registration Number / USCIS Number',
              conditional: {
                field: 'citizenshipStatus',
                operator: 'equals',
                value: 'lpr',
              },
              validations: [{ type: 'required', message: 'USCIS number is required' }],
            },
            {
              id: 'i94Number',
              type: 'text',
              label: 'Form I-94 Admission Number',
              placeholder: '12345678901',
              conditional: {
                field: 'citizenshipStatus',
                operator: 'equals',
                value: 'authorized',
              },
            },
            {
              id: 'workAuthExpiration',
              type: 'date',
              label: 'Work Authorization Expiration Date',
              helpText: 'If applicable',
              conditional: {
                field: 'citizenshipStatus',
                operator: 'equals',
                value: 'authorized',
              },
            },
          ],
        },
        {
          id: 'step-3',
          title: 'Attestation',
          description: 'Sign and certify the information',
          fields: [
            {
              id: 'certify',
              type: 'checkbox',
              label: 'I attest, under penalty of perjury, that I am authorized to work in the United States',
              validations: [{ type: 'required', message: 'Attestation is required' }],
            },
            {
              id: 'signatureDate',
              type: 'date',
              label: 'Today\'s Date',
              defaultValue: new Date().toISOString().split('T')[0],
              validations: [{ type: 'required', message: 'Date is required' }],
            },
          ],
        },
      ],
    },
  };

  // Return the form definition or a default empty form
  return formDefinitions[formId] || {
    id: formId,
    title: 'Form Not Found',
    description: 'This form definition is not available',
    version: '1.0.0',
    steps: [
      {
        id: 'error',
        title: 'Error',
        description: 'Form not found',
        fields: [],
      },
    ],
  };
}
