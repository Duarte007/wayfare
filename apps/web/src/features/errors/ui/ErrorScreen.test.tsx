import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18nReady } from '@/shared/lib/i18n';
import { NotFoundScreen, RouteError, ScreenErrorBoundary } from './ErrorScreen';

let broken = true;
function Flaky() {
  if (broken) throw new Error('boom');
  return <p>Trip details</p>;
}

beforeAll(() => i18nReady);

// React logs caught render errors; keep the test output readable.
beforeEach(() => {
  broken = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom has no scrolling; the router restores scroll on navigation.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('ScreenErrorBoundary', () => {
  it('shows a recoverable error instead of a blank screen', () => {
    render(
      <ScreenErrorBoundary resetKey="/trips/1">
        <Flaky />
      </ScreenErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
    expect(screen.getByRole('link', { name: 'Go to my trips' }).getAttribute('href')).toBe('/');

    broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Trip details')).toBeTruthy();
  });

  it('clears the error when the person navigates elsewhere', () => {
    const { rerender } = render(
      <ScreenErrorBoundary resetKey="/trips/1">
        <Flaky />
      </ScreenErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    broken = false;
    rerender(
      <ScreenErrorBoundary resetKey="/profile">
        <Flaky />
      </ScreenErrorBoundary>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Trip details')).toBeTruthy();
  });
});

function renderRouter(path: string) {
  const root = createRootRoute({
    component: () => (
      <div data-testid="shell">
        <Outlet />
      </div>
    ),
    notFoundComponent: () => <NotFoundScreen signedIn />,
  });
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: '/', component: () => <p>My trips</p> }),
    createRoute({ getParentRoute: () => root, path: '/trips/$tripId', component: Flaky }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultErrorComponent: RouteError,
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('router screens', () => {
  it('renders a crashing route as a recoverable error inside the shell', async () => {
    renderRouter('/trips/1');
    const alert = await screen.findByRole('alert');
    expect(screen.getByTestId('shell').contains(alert)).toBe(true);

    broken = false;
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })));
    expect(await screen.findByText('Trip details')).toBeTruthy();
  });

  it('shows a friendly 404 with a way back to the trips', async () => {
    renderRouter('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Go to my trips' }));
    expect(await screen.findByText('My trips')).toBeTruthy();
  });
});
