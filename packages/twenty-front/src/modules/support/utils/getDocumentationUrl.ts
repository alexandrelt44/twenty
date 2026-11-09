import {
  DOCUMENTATION_BASE_URL,
  type DocumentationPath,
} from 'twenty-shared/constants';

// The fork has no public documentation site, so help links land on the company website.
export const getDocumentationUrl = (_options: {
  locale?: string | null;
  path?: DocumentationPath | string;
}): string => DOCUMENTATION_BASE_URL;
