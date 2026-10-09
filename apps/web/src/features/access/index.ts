/** Public facade of the access feature: prerequisites and permissions of an action, indicative. */
export { type Access, Can, useAccess } from './components/can';
export {
  completablePrerequisites,
  missingPrerequisites,
  type PrerequisiteFormProps,
  type PrerequisiteForms,
  PrerequisiteGateProvider,
  useWithPrerequisites,
} from './components/prerequisite-gate';
