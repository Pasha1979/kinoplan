import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
}
export default meta

type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: { children: 'Default' },
}

export const Outline: Story = {
  args: { children: 'Outline', variant: 'outline' },
}

export const Disabled: Story = {
  args: { children: 'Disabled', disabled: true },
}
