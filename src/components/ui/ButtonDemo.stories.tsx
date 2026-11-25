import type { Meta, StoryObj } from '@storybook/react-vite'
import ButtonDemo from '@/pages/Demo/ButtonDemo'

const meta: Meta<typeof ButtonDemo> = {
  title: 'UI/ButtonDemo',
  component: ButtonDemo,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof ButtonDemo>

export const Page: Story = {}
