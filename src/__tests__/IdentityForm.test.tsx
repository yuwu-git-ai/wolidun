// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IdentityForm from '../features/ordering/components/IdentityForm';

// Mock api module
vi.mock('../shared/api', () => ({
  register: vi.fn(),
  login: vi.fn(),
  setIdentity: vi.fn(),
}));

import { login } from '../shared/api';

describe('IdentityForm', () => {
  const onSave = vi.fn();
  const onSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default', () => {
    render(<IdentityForm onSave={onSave} onSkip={onSkip} />);
    expect(screen.getByText('欢迎光临窝里蹲')).toBeDefined();
    expect(screen.getByText('登录你的账号')).toBeDefined();
    expect(screen.getByPlaceholderText('怎么称呼你？')).toBeDefined();
    expect(screen.getByPlaceholderText('输入密码')).toBeDefined();
  });

  it('shows register fields when switching to register mode', async () => {
    render(<IdentityForm onSave={onSave} onSkip={onSkip} />);
    const registerBtn = screen.getByText('注册');
    await userEvent.click(registerBtn);
    expect(screen.getByPlaceholderText('怎么称呼你？')).toBeDefined();
    expect(screen.getByPlaceholderText('例如：D701')).toBeDefined();
    expect(screen.getByPlaceholderText('设置密码')).toBeDefined();
  });

  it('shows error on empty submission', async () => {
    render(<IdentityForm onSave={onSave} onSkip={onSkip} />);
    // There are two "登录" buttons (tab + submit), use the submit one
    const buttons = screen.getAllByRole('button', { name: '登录' });
    const submitBtn = buttons.find(b => b.getAttribute('type') === 'submit') || buttons[1];
    await userEvent.click(submitBtn);
    expect(screen.getByText('请填写昵称和密码')).toBeDefined();
  });

  it('shows error when registering without dorm', async () => {
    render(<IdentityForm onSave={onSave} onSkip={onSkip} />);
    await userEvent.click(screen.getByText('注册'));
    // Fill nickname and password but not dorm
    await userEvent.type(screen.getByPlaceholderText('怎么称呼你？'), 'testuser');
    await userEvent.type(screen.getByPlaceholderText('设置密码'), 'pass123');
    const submitBtn = screen.getByRole('button', { name: '注册并登录' });
    await userEvent.click(submitBtn);
    expect(screen.getByText('请填写宿舍号')).toBeDefined();
  });

  it('calls onSkip when skip button clicked', async () => {
    render(<IdentityForm onSave={onSave} onSkip={onSkip} />);
    await userEvent.click(screen.getByText('先逛逛'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('submits login and calls onSave on success', async () => {
    const mockLogin = vi.mocked(login);
    mockLogin.mockResolvedValueOnce({ nickname: 'test', dorm: 'D701' });

    render(<IdentityForm onSave={onSave} onSkip={onSkip} />);
    await userEvent.type(screen.getByPlaceholderText('怎么称呼你？'), 'test');
    await userEvent.type(screen.getByPlaceholderText('输入密码'), 'pass');
    // Click the submit button (second "登录" button)
    const buttons = screen.getAllByRole('button', { name: '登录' });
    const submitBtn = buttons.find(b => b.getAttribute('type') === 'submit') || buttons[1];
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('test', 'D701');
    });
  });
});
