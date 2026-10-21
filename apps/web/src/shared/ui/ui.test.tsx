import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField } from './ui';

describe('PasswordField', () => {
  it('toggles visibility with an accessible button', () => {
    render(<PasswordField label="Password" showLabel="Show password" hideLabel="Hide password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveProperty('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveProperty('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('links the hint to the input for screen readers', () => {
    render(
      <PasswordField
        label="Password"
        hint="At least 10 characters."
        showLabel="Show"
        hideLabel="Hide"
      />,
    );
    const input = screen.getByLabelText('Password');
    const hintId = input.getAttribute('aria-describedby');
    expect(hintId && document.getElementById(hintId)?.textContent).toBe('At least 10 characters.');
  });
});
