import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';

import { SettingsDataModelFieldSelectFormOptionRow } from '@/settings/data-model/fields/forms/select/components/SettingsDataModelFieldSelectFormOptionRow';

const OPTION = {
  id: '20202020-0bb5-4a6f-a8b2-774bbad21104',
  value: 'CUSTOMER',
  label: 'Customer',
  position: 0,
  color: 'yellow' as const,
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={createStore()}>{children}</JotaiProvider>
);

describe('SettingsDataModelFieldSelectFormOptionRow stage kind', () => {
  it('hides the stage kind selector when it is not editable', () => {
    render(
      <SettingsDataModelFieldSelectFormOptionRow
        option={OPTION}
        onChange={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('shows Open for an option without a kind and lets the user pick Won', async () => {
    const user = userEvent.setup();
    const onStageKindChange = jest.fn();

    render(
      <SettingsDataModelFieldSelectFormOptionRow
        option={OPTION}
        onChange={jest.fn()}
        onStageKindChange={onStageKindChange}
      />,
      { wrapper: Wrapper },
    );

    await user.click(screen.getByText('Open'));
    await user.click(await screen.findByText('Won'));

    expect(onStageKindChange).toHaveBeenCalledWith('WON');
  });

  it('shows the saved kind of the option', () => {
    render(
      <SettingsDataModelFieldSelectFormOptionRow
        option={OPTION}
        onChange={jest.fn()}
        stageKind="LOST"
        onStageKindChange={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Lost')).toBeInTheDocument();
  });
});
