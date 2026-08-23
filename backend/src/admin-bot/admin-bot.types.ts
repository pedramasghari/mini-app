export type BotButton = {
  text: string;
  callback_data?: string;
  web_app?: { url: string };
};

export type BotKeyboard = { inline_keyboard: BotButton[][] };

export type ConversationState = {
  type: 'service-create' | 'service-edit' | 'payment-reject';
  step: number;
  adminId: number;
  entityId?: string;
  field?: string;
  values: string[];
};

export type TelegramUpdate = {
  update_id: number;
  message?: any;
  callback_query?: any;
};
