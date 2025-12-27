export interface Document {
  id: string;
  title: string;
  description: string;
  category: string[];
  format: string[];
  status: 'available' | 'coming-soon' | 'archived';
  badge?: 'new' | 'updated' | 'popular';
  isFavorite?: boolean;
}

export const documents: Document[] = [
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
  {
    id: 'w4',
    title: 'IRS W-4 Form',
    description: 'Employee\'s Withholding Certificate',
    category: ['Tax', 'Business'],
    format: ['PDF', 'Online'],
    status: 'available',
    isFavorite: false,
  },
  {
    id: 'visa-application',
    title: 'DS-160 Visa Application',
    description: 'Online Nonimmigrant Visa Application',
    category: ['Immigration'],
    format: ['Online'],
    status: 'coming-soon',
    isFavorite: false,
  },
  {
    id: 'notary-acknowledgment',
    title: 'Notary Acknowledgment',
    description: 'Standard notarial certificate',
    category: ['Notary', 'Legal'],
    format: ['PDF'],
    status: 'available',
    isFavorite: false,
  },
  {
    id: '1099-misc',
    title: 'Form 1099-MISC',
    description: 'Miscellaneous Income reporting',
    category: ['Tax', 'Business'],
    format: ['PDF', 'Online'],
    status: 'available',
    badge: 'popular',
    isFavorite: false,
  },
  {
    id: 'lease-agreement',
    title: 'Residential Lease Agreement',
    description: 'Standard rental contract for residential property',
    category: ['Legal'],
    format: ['DOCX', 'PDF'],
    status: 'available',
    isFavorite: false,
  },
  {
    id: 'bill-of-sale',
    title: 'Bill of Sale',
    description: 'Generic bill of sale for personal property',
    category: ['Legal'],
    format: ['PDF', 'DOCX'],
    status: 'available',
    isFavorite: false,
  },
];
