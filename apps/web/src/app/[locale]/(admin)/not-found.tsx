import { NotFoundView } from '@/components/layout/states/not-found-view';
import { routes } from '@/config/routes';

/** A page of the group that does not exist for this reader. */
export default function GroupNotFound() {
  return <NotFoundView home={routes.admin} />;
}
