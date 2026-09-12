import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
  subscribyApiRequest,
  subscribyApiRequestAllItems,
  compactBody,
  splitCodes,
  toNodeError,
} from './GenericFunctions';

/**
 * Primary action node — exposes every write + search route documented at
 * https://docs.subscriby.net/api. Triggers live in SubscribyTrigger.
 *
 * Convention mirrors the Subscriby REST surface: (resource, operation)
 * maps 1:1 to a single route.
 */
export class Subscriby implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Subscriby',
    name: 'subscriby',
    icon: { light: 'file:subscriby.svg', dark: 'file:subscriby.dark.svg' },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Manage Subscriby projects, plans, subscriptions, and members.',
    defaults: {
      name: 'Subscriby',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [
      {
        name: 'subscribyApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Access Code', value: 'accessCode' },
          { name: 'Account', value: 'account' },
          { name: 'Activity', value: 'activity' },
          { name: 'Analytics', value: 'analytics' },
          { name: 'Bot', value: 'bot' },
          { name: 'Broadcast', value: 'broadcast' },
          { name: 'Canned Reply', value: 'cannedReply' },
          { name: 'Connector', value: 'connector' },
          { name: 'Coupon', value: 'coupon' },
          { name: 'Creator Task', value: 'creatorTask' },
          { name: 'Distribution', value: 'distribution' },
          { name: 'Group', value: 'group' },
          { name: 'Member', value: 'member' },
          { name: 'Pass Window', value: 'passWindow' },
          { name: 'Payment Method', value: 'paymentMethod' },
          { name: 'Plan', value: 'plan' },
          { name: 'Project', value: 'project' },
          { name: 'Recovery', value: 'recovery' },
          { name: 'Resource', value: 'resource' },
          { name: 'Role', value: 'role' },
          { name: 'Subscriber', value: 'subscriber' },
          { name: 'Subscription', value: 'subscription' },
          { name: 'Support Conversation', value: 'supportConversation' },
          { name: 'Support Inbox', value: 'supportSettings' },
          { name: 'Team', value: 'team' },
          { name: 'Team Member', value: 'teamMember' },
          { name: 'Token', value: 'token' },
          { name: 'Webhook Delivery', value: 'webhookDelivery' },
          { name: 'Webhook Endpoint', value: 'webhookEndpoint' },
        ],
        default: 'project',
      },

      // === PROJECT ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['project'] } },
        options: [
          { name: 'Archive', value: 'archive', action: 'Archive a project', description: 'Soft-delete a project' },
          { name: 'Create', value: 'create', action: 'Create a project', description: 'Create a new project' },
          { name: 'Delete', value: 'delete', action: 'Delete a project', description: 'Permanently delete a project' },
          { name: 'Find by Handle', value: 'findByHandle', action: 'Find a project by handle', description: 'Return the first project whose handle matches' },
          { name: 'Get', value: 'get', action: 'Get a project', description: 'Fetch a project by UUID' },
          { name: 'List', value: 'list', action: 'List projects', description: 'List all projects visible to the current team' },
          { name: 'Restore', value: 'restore', action: 'Restore a project', description: 'Restore an archived project' },
          { name: 'Update', value: 'update', action: 'Update a project', description: 'Update an existing project' },
        ],
        default: 'create',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['project'], operation: ['create'] } },
        description: 'Display name for the new project',
      },
      {
        displayName: 'Handle',
        name: 'handle',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['project'], operation: ['create', 'findByHandle'] } },
        description: 'URL-safe handle (lowercase letters, numbers, hyphens)',
      },
      {
        displayName: 'Platform',
        name: 'platform',
        type: 'options',
        options: [
          { name: 'Telegram', value: 'telegram' },
        ],
        default: 'telegram',
        displayOptions: { show: { resource: ['project'], operation: ['create'] } },
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['project'], operation: ['update', 'archive', 'restore', 'delete', 'get'] } },
        description: 'UUID of the project',
      },
      {
        displayName: 'Update Fields',
        name: 'updateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['project'], operation: ['update'] } },
        options: [
          { displayName: 'Name', name: 'name', type: 'string', default: '' },
          { displayName: 'Description', name: 'description', type: 'string', default: '', typeOptions: { rows: 3 } },
          { displayName: 'Website URL', name: 'website_url', type: 'string', default: '' },
        ],
      },

      // === PASS WINDOW ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['passWindow'] } },
        options: [
          { name: 'Cancel', value: 'cancel', action: 'Cancel a pass window', description: 'Cancel a window before it opens; holders are moved to the next window or marked for refund' },
          { name: 'Create', value: 'create', action: 'Create a pass window', description: "Add one dated window to a pass plan's schedule" },
          { name: 'Get', value: 'get', action: 'Get a pass window', description: 'Fetch one window by UUID, with its holder count and whether it is still on sale' },
          { name: 'List', value: 'list', action: 'List pass windows', description: "List the dated access windows a project's pass plans generate, with their IDs" },
          { name: 'Remind Queue', value: 'remindQueue', action: 'Remind the pass window queue', description: 'Nudge every holder of the window who has not joined yet' },
        ],
        default: 'list',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['passWindow'] } },
      },
      {
        displayName: 'Window ID',
        name: 'windowId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['passWindow'], operation: ['get', 'cancel', 'remindQueue'] } },
        description: 'UUID of the pass window',
      },
      {
        displayName: 'Pass Plan ID',
        name: 'planId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['passWindow'], operation: ['create'] } },
        description: 'UUID of the time-limited pass plan the window belongs to',
      },
      {
        displayName: 'Starts At',
        name: 'startsAt',
        type: 'dateTime',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['passWindow'], operation: ['create'] } },
        description: "When the window opens. Must be in the future. A value without a UTC offset is read in the plan's pass timezone.",
      },
      {
        displayName: 'Duration (Minutes)',
        name: 'durationMinutes',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 60,
        required: true,
        displayOptions: { show: { resource: ['passWindow'], operation: ['create'] } },
        description: 'How long the window stays open, in minutes',
      },
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['passWindow'], operation: ['list'] } },
        options: [
          { displayName: 'On Sale Only', name: 'sellable_only', type: 'boolean', default: false, description: "Whether to return only windows a customer can buy right now, after the plan's sales cutoff. Not the same as Status." },
          { displayName: 'Pass Plan ID', name: 'plan_id', type: 'string', default: '', description: 'Narrow to one pass plan. Omit for every pass plan on the project.' },
          { displayName: 'Starting After', name: 'from', type: 'dateTime', default: '' },
          { displayName: 'Starting Before', name: 'to', type: 'dateTime', default: '' },
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            options: [
              { name: 'Canceled', value: 'canceled' },
              { name: 'Closed', value: 'closed', description: 'Finished' },
              { name: 'Open', value: 'open', description: 'Running now' },
              { name: 'Scheduled', value: 'scheduled', description: 'Not yet open' },
            ],
            default: 'scheduled',
          },
        ],
      },


      // === BROADCAST ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['broadcast'] } },
        options: [
          { name: 'List Audiences', value: 'listAudiences', action: 'List broadcast audiences', description: 'List every audience segment with its current recipient count' },
          { name: 'Preview', value: 'preview', action: 'Preview a broadcast audience', description: 'Size an audience without sending anything' },
          { name: 'Send', value: 'send', action: 'Send a broadcast', description: 'Queue a Telegram message to a segment of the project members' },
        ],
        default: 'preview',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['broadcast'] } },
      },
      {
        displayName: 'Message',
        name: 'broadcastMessage',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['broadcast'], operation: ['send'] } },
        description: 'Up to 4096 characters. Telegram HTML only (b, i, u, s, a, code, pre, blockquote, tg-spoiler); anything else is stripped before sending.',
      },
      {
        displayName: 'Audience',
        name: 'broadcastAudience',
        type: 'options',
        default: 'all',
        displayOptions: { show: { resource: ['broadcast'], operation: ['send', 'preview'] } },
        options: [
          { name: 'All Active Pass Holders', value: 'all_pass_holders' },
          { name: 'All Active Pass Holders Not in Queue', value: 'all_pass_holders_not_in_queue' },
          { name: 'All Users', value: 'all' },
          { name: 'Cancelled, Still Inside Their Period', value: 'cancelled_still_active' },
          { name: 'Churned Users', value: 'churned' },
          { name: 'Customers Only', value: 'customer' },
          { name: 'Expiring Soon', value: 'expiring_soon' },
          { name: 'Leads', value: 'lead' },
          { name: 'Pass Holders (One Window)', value: 'pass_holders' },
          { name: 'Pass Holders Not in Queue (One Window)', value: 'pass_holders_not_in_queue' },
          { name: 'Paused Subscriptions', value: 'paused' },
          { name: 'Trialing Users', value: 'trialing' },
          { name: 'Trialing Without a Card', value: 'trialing_cardless' },
        ],
        description: 'Which members to address. The two single-window segments also need a Pass Window ID. Expiring Soon reads the Running Out Within field.',
      },
      {
        displayName: 'Pass Window ID',
        name: 'broadcastPassWindowId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['broadcast'], operation: ['send', 'preview'] } },
        description: 'Required only for the two single-window pass segments. Ignored by every other audience.',
      },
      {
        displayName: 'Plan ID',
        name: 'broadcastPlanId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['broadcast'], operation: ['send', 'preview'] } },
        description: 'Optional. Narrows the audience to one plan rather than replacing it — Customers plus a plan reaches people paying for it right now, Churned plus a plan reaches people who held it and left. Rejected for Leads and for the pass segments.',
      },
      {
        displayName: 'Running Out Within (Days)',
        name: 'broadcastExpiringWithinDays',
        type: 'number',
        default: 7,
        typeOptions: { minValue: 1, maxValue: 90 },
        displayOptions: { show: { resource: ['broadcast'], operation: ['send', 'preview'], broadcastAudience: ['expiring_soon'] } },
        description: 'How far ahead the Expiring Soon audience looks. Members are counted only if their access genuinely lapses: a subscription that renews by itself is not expiring, so someone appears only once they have turned renewal off.',
      },

      // === PLAN ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['plan'] } },
        options: [
          { name: 'Arrange Storefront Order', value: 'reorder', action: 'Arrange the storefront order of plans', description: 'Pin the order the portal and the bot list the plans in; an empty list restores the built-in order' },
          { name: 'Create', value: 'create', action: 'Create a plan', description: 'Create a subscription plan under a project' },
          { name: 'Delete', value: 'delete', action: 'Delete a plan', description: 'Permanently delete a plan' },
          { name: 'Find by Name', value: 'findByName', action: 'Find a plan by name', description: 'Return the first plan whose name matches' },
          { name: 'Get', value: 'get', action: 'Get a plan', description: 'Fetch a plan by UUID' },
          { name: 'List', value: 'list', action: 'List plans', description: 'List all plans under a project' },
          { name: 'Publish', value: 'publish', action: 'Publish a plan', description: 'Make a plan publicly purchasable' },
          { name: 'Start Next Season', value: 'startNextSeason', action: 'Start the next season of a pass series', description: 'Create the successor of a pass series plan, carrying its rules onto the next run of windows' },
          { name: 'Unpublish', value: 'unpublish', action: 'Unpublish a plan', description: 'Hide a plan from purchase' },
          { name: 'Update', value: 'update', action: 'Update a plan', description: 'Update plan attributes' },
        ],
        default: 'create',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'] } },
      },
      {
        displayName: 'Plan ID',
        name: 'planId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['update', 'publish', 'unpublish', 'get', 'delete', 'startNextSeason'] } },
      },
      {
        displayName: 'Plan Name',
        name: 'planName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['findByName'] } },
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: '5-255 characters, unique within the project',
      },
      {
        displayName: 'Plan Kind',
        name: 'kind',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Recurring Subscription', value: 'subscription', description: 'Access starts at payment and renews on a cycle' },
          { name: 'Time-Limited Pass', value: 'pass', description: 'One dated access window per purchase' },
          { name: 'Pass Series', value: 'pass_series', description: "A season ticket over many of your pass plans' windows" },
        ],
        default: 'subscription',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'] } },
        description: 'Decides which fields apply below. The API refuses a block belonging to another kind, so this must match the plan.',
      },
      {
        displayName: 'Currency Name or ID',
        name: 'currencyId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'UUID from /v1/currencies. Must be supported by an active payment method on the project.',
      },
      {
        displayName: 'Price',
        name: 'price',
        type: 'number',
        typeOptions: { minValue: 0, numberPrecision: 2 },
        default: 0,
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'Decimal, not cents. On a pass this buys one window; on a pass series it buys the whole slate, once.',
      },
      {
        displayName: 'Resource Names or IDs',
        name: 'resources',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'Comma-separated project resource UUIDs. Required on Recurring Subscription and Time-Limited Pass — a plan with no linked resource cannot be redeemed. Optional on Pass Series, where it means a lounge the holder keeps for the whole span.',
      },
      {
        displayName: 'Sales Cap',
        name: 'salesCap',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 100000 },
        default: 0,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'Paid purchases allowed before the plan pauses itself with the reason Sold Out (1-100000). 0 means no limit; access codes and trials never count.',
      },
      {
        displayName: 'Plan IDs in Order',
        name: 'planIds',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['plan'], operation: ['reorder'] } },
        description: 'Comma-separated plan UUIDs, first shown first. Every ID must belong to the project; a plan left out follows the pinned ones in the built-in order. Leave empty to restore the built-in order for every plan.',
      },

      // --- kind: subscription ---
      {
        displayName: 'Billing',
        name: 'billing',
        type: 'collection',
        placeholder: 'Add Billing Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['subscription'] } },
        options: [
          {
            displayName: 'Billing Cycle',
            name: 'billing_cycle',
            type: 'options',
            options: [
              { name: 'Day', value: 'day' },
              { name: 'Lifetime', value: 'lifetime' },
              { name: 'Month', value: 'month' },
              { name: 'Week', value: 'week' },
              { name: 'Year', value: 'year' },
            ],
            default: 'month',
          },
          { displayName: 'Cardless Trial', name: 'trial_cardless', type: 'boolean', default: false, description: 'Whether the trial can start without a payment method on file' },
          { displayName: 'Cycle Count', name: 'billing_cycle_count', type: 'number', typeOptions: { minValue: 1, maxValue: 99 }, default: 1, description: 'Must be 1 when Billing Cycle is Lifetime' },
          { displayName: 'Disabled Renewal', name: 'disabled_renewal', type: 'boolean', default: false, description: 'Whether to charge once and then lapse rather than renewing' },
          { displayName: 'Recurring', name: 'recurring', type: 'boolean', default: true, description: 'Whether to charge on a repeating cycle. Crypto and platform currencies require this off.' },
          { displayName: 'Trial Days', name: 'trial_days', type: 'number', typeOptions: { minValue: 0, maxValue: 365 }, default: 0 },
        ],
      },

      // --- kind: pass ---
      {
        displayName: 'Pass Schedule',
        name: 'pass',
        type: 'collection',
        placeholder: 'Add Schedule Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass'] } },
        options: [
          {
            displayName: 'Cutoff Anchor',
            name: 'sales_cutoff_anchor',
            type: 'options',
            options: [
              { name: 'Before a Window Ends', value: 'before_end', description: 'Keeps selling while the window runs, so a buyer can join a session already in progress. Needs at least 5 minutes and must be under the shortest slot length.' },
              { name: 'Before a Window Starts', value: 'before_start', description: 'Nothing sells once a window is running' },
            ],
            default: 'before_start',
          },
          {
            displayName: 'Repeats',
            name: 'recurrence',
            type: 'options',
            options: [
              { name: 'Daily', value: 'daily' },
              { name: 'Monthly', value: 'monthly' },
              { name: 'Weekly', value: 'weekly' },
            ],
            default: 'weekly',
            description: 'Decides which slot fields apply: weekly uses Weekday, monthly uses Day of Month, daily uses neither',
          },
          {
            displayName: 'Schedule Mode',
            name: 'schedule_mode',
            type: 'options',
            options: [
              { name: 'Fixed', value: 'fixed', description: 'Place each window by hand' },
              { name: 'Repeating', value: 'repeating', description: 'Generate windows from the slots below' },
            ],
            default: 'repeating',
          },
          { displayName: 'Stop Generating After', name: 'recurrence_ends_at', type: 'dateTime', default: '', description: 'When window generation stops' },
          { displayName: 'Stop Selling (Minutes)', name: 'sales_cutoff_minutes', type: 'number', typeOptions: { minValue: 0 }, default: 0, description: 'Close sales this many minutes before the moment the anchor names' },
          { displayName: 'Timezone', name: 'timezone', type: 'string', default: 'UTC', description: 'IANA zone, e.g. America/New_York. Window times are local wall-clock in this zone and hold steady across daylight saving.' },
        ],
      },
      {
        displayName: 'Access Windows',
        name: 'passSlots',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add Window',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass'] } },
        description: 'Sending these REPLACES the whole schedule and rebuilds unsold future windows. Windows customers already bought keep their original times.',
        options: [
          {
            name: 'slot',
            displayName: 'Window',
            values: [
              { displayName: 'Weekday', name: 'weekday', type: 'number', typeOptions: { minValue: 0, maxValue: 6 }, default: 0, description: '0-6 with 0 = Sunday. Weekly recurrence only.' },
              { displayName: 'Day of Month', name: 'day_of_month', type: 'number', typeOptions: { minValue: 1, maxValue: 31 }, default: 1, description: 'Monthly recurrence only. 29-31 skip months that lack the day.' },
              { displayName: 'Starts At', name: 'start_time', type: 'string', default: '09:00', description: 'HH:MM local wall-clock in the schedule timezone' },
              { displayName: 'Lasts (Minutes)', name: 'duration_minutes', type: 'number', typeOptions: { minValue: 5 }, default: 180, description: 'Each window carries its own length, so one plan can mix a 3-hour and a 14-hour window' },
            ],
          },
        ],
      },

      // --- kind: pass_series ---
      {
        displayName: 'Pass Window Names or IDs',
        name: 'seriesWindowIds',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass_series'] } },
        description: 'Comma-separated UUIDs of windows that ALREADY EXIST on your pass plans — a series never creates any. Use the Pass Window: List operation to find them. Needs at least two, unless a rule below supplies them.',
      },
      {
        displayName: 'Series Settings',
        name: 'passSeries',
        type: 'collection',
        placeholder: 'Add Series Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass_series'] } },
        options: [
          {
            displayName: 'Cutoff Anchor',
            name: 'sales_cutoff_anchor',
            type: 'options',
            options: [
              { name: 'Before the First Pass Opens', value: 'before_start', description: 'Nobody buys a season already underway' },
              { name: 'Before the Last Pass Ends', value: 'before_end', description: 'Keeps selling mid-season at full price for whatever is left. Nothing is prorated.' },
            ],
            default: 'before_start',
          },
          { displayName: 'Excluded Window IDs', name: 'blackout_window_ids', type: 'string', default: '', description: 'Comma-separated window UUIDs a rule matches but you want permanently excluded' },
          { displayName: 'Holders Buy First For (Hours)', name: 'presale_hours', type: 'number', typeOptions: { minValue: 1, maxValue: 8760 }, default: 48, description: 'How long the next season is held for existing holders before general sale' },
          { displayName: 'Next Series Plan ID', name: 'successor_plan_id', type: 'string', default: '', description: 'Another Pass Series on this project. When this season finishes, its holders are invited to buy that one first.' },
          { displayName: 'Prevent Overlapping Passes', name: 'prevent_overlaps', type: 'boolean', default: true, description: 'Whether to refuse a window that clashes with one already on the slate, so holders are never handed two things at the same time' },
          { displayName: 'Seat Limit', name: 'seat_cap', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'How many people may hold this series at once. Omit for unlimited.' },
          { displayName: 'Stop Selling (Minutes)', name: 'sales_cutoff_minutes', type: 'number', typeOptions: { minValue: 0 }, default: 0, description: 'Measured against the WHOLE season, not one window' },
        ],
      },
      {
        displayName: 'Automatic Inclusion Rules',
        name: 'seriesRules',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add Rule',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass_series'] } },
        description: 'Rules keep working after the save: a matching window scheduled later is added to the slate AND granted to everyone already holding the series, at no charge. Handpicked window IDs never grow on their own.',
        options: [
          {
            name: 'rule',
            displayName: 'Rule',
            values: [
											{
												displayName: 'Number of Passes to Take',
												name: 'take',
												type: 'number',
												default: 5,
												description: 'REQUIRED when the rule type is The Next Few Passes. A count rule takes that many and then stops	—	it never tops itself back up.',
											},
											{
												displayName: 'Rule Type',
												name: 'kind',
												type: 'options',
												options: [
													{
														name: 'Every Pass Starting in a Period',
														value: 'date_range',
													},
													{
														name: 'The Next Few Passes',
														value: 'next_n',
													},
												],
												default: 'date_range',
											},
											{
												displayName: 'Source Pass Plan ID',
												name: 'source_plan_id',
												type: 'string',
												default: '',
												description: 'Must be a Time-Limited Pass plan on this project',
											},
											{
												displayName: 'Watch From',
												name: 'from_at',
												type: 'dateTime',
												default: '',
											},
											{
												displayName: 'Watch Until',
												name: 'to_at',
												type: 'dateTime',
												default: '',
											},
									],
          },
        ],
      },

      {
        displayName: 'Update Fields',
        name: 'updateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['update'] } },
        options: [
          { displayName: 'Active', name: 'active', type: 'boolean', default: true },
          { displayName: 'Description', name: 'description', type: 'string', default: '', typeOptions: { rows: 3 } },
          { displayName: 'Name', name: 'name', type: 'string', default: '' },
          { displayName: 'Price', name: 'price', type: 'number', typeOptions: { numberPrecision: 2 }, default: 0 },
          { displayName: 'Sales Cap', name: 'sales_cap', type: 'number', typeOptions: { minValue: 0, maxValue: 100000 }, default: 0, description: 'Paid purchases allowed before the plan pauses itself. 0 lifts the cap; changing the cap restarts the count.' },
        ],
      },

      // === SUBSCRIPTION ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['subscription'] } },
        options: [
          { name: 'Cancel', value: 'cancel', action: 'Cancel a subscription', description: 'Cancel a subscription immediately or at period end' },
          { name: 'Get', value: 'get', action: 'Get a subscription', description: 'Fetch a subscription by UUID' },
          { name: 'List', value: 'list', action: 'List subscriptions', description: 'List subscriptions filtered by status or plan' },
          {
            name: 'List Grants',
            value: 'listGrants',
            action: 'List subscription grants',
            description:
              'List the access grants a subscription holds: one per resource and pass window, with the connector, how access was given, its state and why it failed if it did',
          },
          { name: 'Pause Access', value: 'pause', action: 'Pause subscription access', description: 'Suspend the member resource access. Billing is unaffected and continues on schedule.' },
          { name: 'Reactivate', value: 'reactivate', action: 'Reactivate a subscription', description: 'Call off a scheduled cancellation. Stripe only; other providers end the agreement outright.' },
          {
            name: 'Reissue Grants',
            value: 'reissueGrants',
            action: 'Reissue subscription grants',
            description:
              'Revoke the access grants a member holds (every resource, or one) and issue fresh ones. The member is sent the new links by the bot.',
          },
          { name: 'Remind Pass Holder', value: 'remind', action: 'Remind a pass holder', description: 'Nudge a pass holder who has not joined their window yet. Returns whether anything was sent.' },
          { name: 'Unpause Access', value: 'unpause', action: 'Unpause subscription access', description: 'Restore suspended access and issue fresh invite links' },
        ],
        default: 'cancel',
      },
      {
        displayName: 'Subscription ID',
        name: 'subscriptionId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['subscription'],
            operation: ['cancel', 'get', 'listGrants', 'pause', 'unpause', 'reactivate', 'reissueGrants', 'remind'],
          },
        },
      },
      {
        displayName: 'Resource ID',
        name: 'grantResourceId',
        type: 'string',
        default: '',
        description: 'Limit the reissue to one resource UUID of the plan. Leave empty to reissue every resource the subscription grants.',
        displayOptions: { show: { resource: ['subscription'], operation: ['reissueGrants'] } },
      },
      {
        displayName: 'Filters',
        name: 'subscriptionListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['subscription'], operation: ['list'] } },
        options: [
          { displayName: 'Status', name: 'status', type: 'string', default: '', description: 'Filter by subscription status (e.g. active, cancelled, trial)' },
          { displayName: 'Plan ID', name: 'planId', type: 'string', default: '', description: 'Filter by plan UUID' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
        ],
      },
      {
        displayName: 'Cancel at Period End',
        name: 'atPeriodEnd',
        type: 'boolean',
        default: true,
        displayOptions: { show: { resource: ['subscription'], operation: ['cancel'] } },
        description: 'Whether to let the subscription run until its current period ends. Off = cancel immediately.',
      },

      // === MEMBER ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['member'] } },
        options: [
          { name: 'Ban', value: 'ban', action: 'Ban a member', description: 'Ban a member from the project community' },
          { name: 'Get', value: 'get', action: 'Get a member', description: 'Fetch a member by UUID' },
          { name: 'Kick', value: 'kick', action: 'Kick a member', description: 'Remove a member without a permanent ban' },
          { name: 'List', value: 'list', action: 'List members', description: 'List members of a project' },
          { name: 'List Identities', value: 'listIdentities', action: 'List a members connected accounts', description: 'List the platform accounts a member has connected, with the preferred one marked' },
          { name: 'Unban', value: 'unban', action: 'Unban a member', description: 'Lift a previous ban' },
          { name: 'Unlink Identity', value: 'unlinkIdentity', action: 'Disconnect a members connected account', description: 'Disconnect one of a member\'s platform accounts; refused when it is their last way to sign in' },
        ],
        default: 'ban',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['member'] } },
      },
      {
        displayName: 'Member ID',
        name: 'memberId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['member'], operation: ['ban', 'unban', 'kick', 'get', 'listIdentities', 'unlinkIdentity'] } },
      },
      {
        displayName: 'Identity Link ID',
        name: 'identityId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['member'], operation: ['unlinkIdentity'] } },
        description: 'The ID of the connected account from List Identities (the link, not the platform\'s own account ID)',
      },
      {
        displayName: 'Filters',
        name: 'memberListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['member'], operation: ['list'] } },
        options: [
          { displayName: 'Status', name: 'status', type: 'string', default: '', description: 'Filter by member status (e.g. active, banned, kicked)' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
        ],
      },
      {
        displayName: 'Reason',
        name: 'reason',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['member'], operation: ['ban', 'kick'] } },
        description: 'Optional moderator note recorded with the action',
      },

      // === SUPPORT CONVERSATION ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['supportConversation'] } },
        options: [
          { name: 'Assign', value: 'assign', action: 'Assign a support conversation', description: 'Hand the conversation to a team member, or clear the assignment' },
          { name: 'Block Contact', value: 'block', action: 'Block a support contact', description: 'Stop the member from reaching the inbox; their messages are dropped until unblocked' },
          { name: 'Get', value: 'get', action: 'Get a support conversation', description: 'Fetch one conversation by UUID' },
          { name: 'List', value: 'list', action: 'List support conversations', description: 'List conversations, newest activity first' },
          { name: 'List Messages', value: 'listMessages', action: 'List support messages', description: 'Fetch the messages in a conversation, oldest first' },
          { name: 'Reopen', value: 'reopen', action: 'Reopen a support conversation', description: 'Put a resolved conversation back in the open queue' },
          { name: 'Reply', value: 'reply', action: 'Reply to a support conversation', description: 'Send a reply the member receives on Telegram' },
          { name: 'Resolve', value: 'resolve', action: 'Resolve a support conversation', description: 'Clear the conversation from the open queue' },
          { name: 'Unblock Contact', value: 'unblock', action: 'Unblock a support contact', description: 'Let a blocked member reach the inbox again' },
        ],
        default: 'list',
      },
      {
        displayName: 'Conversation ID',
        name: 'conversationId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['supportConversation'], operation: ['get', 'listMessages', 'reply', 'resolve', 'assign', 'reopen', 'block', 'unblock'] } },
      },
      {
        displayName: 'Reply',
        name: 'replyBody',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['supportConversation'], operation: ['reply'] } },
        description: 'Reaches the member verbatim on Telegram, attributed to you rather than the bot. Max 4000 characters.',
      },
      {
        displayName: 'Quote Message ID',
        name: 'replyToMessageId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['supportConversation'], operation: ['reply'] } },
        description: 'Optional UUID of a message in this same conversation to quote above the reply. Must belong to this conversation.',
      },
      {
        displayName: 'Internal Note',
        name: 'replyInternal',
        type: 'boolean',
        default: false,
        displayOptions: { show: { resource: ['supportConversation'], operation: ['reply'] } },
        description: 'Whether to record a private note for your team instead of replying to the member',
      },
      {
        displayName: 'Assignee',
        name: 'assignedToUserId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['supportConversation'], operation: ['assign'] } },
        description: 'Team-member user UUID. Leave empty to clear an existing assignment.',
      },
      {
        displayName: 'Filters',
        name: 'supportConversationListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['supportConversation'], operation: ['list', 'listMessages'] } },
        options: [
          { displayName: 'Assigned To', name: 'assignedTo', type: 'string', default: '', description: 'Only conversations assigned to this team-member UUID' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Project ID', name: 'projectId', type: 'string', default: '', description: 'Narrow to a single project' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          { displayName: 'Status', name: 'status', type: 'options', default: 'open', options: [
            { name: 'Open', value: 'open' },
            { name: 'Pending', value: 'pending' },
            { name: 'Resolved', value: 'resolved' },
            { name: 'Snoozed', value: 'snoozed' },
          ], description: 'Filter by conversation status' },
        ],
      },

      // === CANNED REPLY ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['cannedReply'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a canned reply', description: "Save a reply snippet to the project's support picker" },
          { name: 'Delete', value: 'delete', action: 'Delete a canned reply', description: 'Remove a saved reply. Replies already sent with it are untouched.' },
          { name: 'Get', value: 'get', action: 'Get a canned reply', description: 'Fetch one saved reply by UUID' },
          { name: 'List', value: 'list', action: 'List canned replies', description: "List the saved replies in a project's support picker" },
          { name: 'Update', value: 'update', action: 'Update a canned reply', description: 'Change a saved reply. Fields you leave out keep their stored values.' },
        ],
        default: 'list',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['cannedReply'] } },
      },
      {
        displayName: 'Canned Reply ID',
        name: 'cannedReplyId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['cannedReply'], operation: ['get', 'update', 'delete'] } },
        description: 'UUID of the saved reply',
      },
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['cannedReply'], operation: ['create'] } },
        description: 'The label shown in the picker, 2-80 characters',
      },
      {
        displayName: 'Body',
        name: 'body',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['cannedReply'], operation: ['create'] } },
        description: 'The text inserted when the reply is picked, 2-4000 characters',
      },
      {
        displayName: 'Additional Fields',
        name: 'cannedReplyFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['cannedReply'], operation: ['create'] } },
        options: [
          { displayName: 'Shortcut', name: 'shortcut', type: 'string', default: '', description: 'A keyword agents type to pick the reply. Letters, numbers, dashes and underscores, up to 30 characters, unique within the project.' },
          { displayName: 'Sort Order', name: 'sort_order', type: 'number', typeOptions: { minValue: 0, maxValue: 999 }, default: 0, description: 'Position in the picker; lower comes first' },
        ],
      },
      {
        displayName: 'Update Fields',
        name: 'cannedReplyUpdateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['cannedReply'], operation: ['update'] } },
        options: [
          { displayName: 'Body', name: 'body', type: 'string', typeOptions: { rows: 4 }, default: '', description: 'The text inserted when the reply is picked, 2-4000 characters' },
          { displayName: 'Shortcut', name: 'shortcut', type: 'string', default: '', description: 'A keyword agents type to pick the reply. Letters, numbers, dashes and underscores, up to 30 characters, unique within the project. Empty clears it.' },
          { displayName: 'Sort Order', name: 'sort_order', type: 'number', typeOptions: { minValue: 0, maxValue: 999 }, default: 0, description: 'Position in the picker; lower comes first' },
          { displayName: 'Title', name: 'title', type: 'string', default: '', description: 'The label shown in the picker, 2-80 characters' },
        ],
      },

      // === SUPPORT SETTINGS ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['supportSettings'] } },
        options: [
          { name: 'Get Settings', value: 'get', action: 'Get support inbox settings', description: "Read a project's support inbox settings" },
          { name: 'Update Settings', value: 'update', action: 'Update support inbox settings', description: "Change a project's support inbox settings. Fields you leave out keep their stored values." },
        ],
        default: 'get',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['supportSettings'] } },
      },
      {
        displayName: 'Update Fields',
        name: 'supportSettingsFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['supportSettings'], operation: ['update'] } },
        options: [
          { displayName: 'Agent Name', name: 'agent_name', type: 'string', default: '', description: 'The name members see on replies, up to 60 characters. Empty falls back to the project name.' },
          { displayName: 'Auto Reply', name: 'auto_reply', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Sent automatically when a member opens a thread, up to 1000 characters. Empty sends nothing.' },
          { displayName: 'Enabled', name: 'enabled', type: 'boolean', default: true, description: 'Whether members can open support threads with the bot' },
          { displayName: 'Notify by Email', name: 'notify_email', type: 'boolean', default: true, description: 'Whether the creator is emailed about new threads' },
          {
            displayName: 'Relay Mode',
            name: 'relay_mode',
            type: 'options',
            options: [
              { name: 'Inbox Only', value: 'none', description: 'New threads stay in the dashboard inbox' },
              { name: 'Owner DM', value: 'owner_dm', description: 'New threads are also forwarded to the creator on Telegram' },
              { name: 'Forum Group', value: 'forum_group', description: 'New threads are forwarded to a Telegram group with Topics enabled where the project bot is an administrator' },
            ],
            default: 'none',
            description: 'Where new threads go besides the dashboard inbox',
          },
        ],
      },

      // === SUBSCRIBER ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['subscriber'] } },
        options: [
          { name: 'Find by Telegram ID', value: 'findByTelegramId', action: 'Find a subscriber by telegram id', description: 'Return the subscriber whose Telegram user ID matches' },
        ],
        default: 'findByTelegramId',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['subscriber'] } },
      },
      {
        displayName: 'Telegram ID',
        name: 'telegramId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['subscriber'], operation: ['findByTelegramId'] } },
        description: 'Numeric Telegram user ID (the value Telegram hands to bots)',
      },

      // === ACCESS CODE ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['accessCode'] } },
        options: [
          { name: 'Bulk Generate', value: 'bulkGenerate', action: 'Bulk generate access codes', description: 'Generate a batch of single-use access codes for a plan' },
          { name: 'List', value: 'list', action: 'List access codes', description: 'List all access codes under a plan' },
          { name: 'Delete', value: 'delete', action: 'Delete an access code', description: 'Revoke a single access code' },
          { name: 'Preview', value: 'preview', action: 'Preview access code generation', description: 'Dry-run generation to preview the codes that would be issued' },
        ],
        default: 'bulkGenerate',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['accessCode'] } },
      },
      {
        displayName: 'Plan ID',
        name: 'planId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['accessCode'] } },
      },
      {
        displayName: 'Access Code ID',
        name: 'accessCodeId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['accessCode'], operation: ['delete'] } },
        description: 'UUID of the access code to revoke',
      },
      {
        displayName: 'Quantity',
        name: 'quantity',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 1000 },
        default: 10,
        required: true,
        displayOptions: { show: { resource: ['accessCode'], operation: ['bulkGenerate', 'preview'] } },
      },
      {
        displayName: 'Expires In Days',
        name: 'expiresInDays',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 30,
        displayOptions: { show: { resource: ['accessCode'], operation: ['bulkGenerate'] } },
        description: 'Days until the generated codes expire if unused',
      },
      {
        displayName: 'Filters',
        name: 'accessCodeListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['accessCode'], operation: ['list'] } },
        options: [
          { displayName: 'Status', name: 'status', type: 'string', default: '', description: 'Filter by access code status (e.g. active, redeemed, expired)' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
        ],
      },

      // === COUPON ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['coupon'] } },
        options: [
          { name: 'Activate', value: 'activate', action: 'Activate a coupon', description: 'Switch a code back on so subscribers can redeem it' },
          { name: 'Create', value: 'create', action: 'Create a coupon', description: 'Issue a discount code any number of subscribers can redeem for money off their first payment' },
          { name: 'Deactivate', value: 'deactivate', action: 'Deactivate a coupon', description: 'Retire a code safely: new redemptions stop, recorded ones are kept' },
          { name: 'Delete', value: 'delete', action: 'Delete a coupon', description: 'Remove a code and its redemption history. Refused while a checkout still holds it.' },
          { name: 'Get', value: 'get', action: 'Get a coupon', description: 'Fetch a coupon by UUID' },
          { name: 'List', value: 'list', action: 'List coupons', description: "List a project's coupons, optionally narrowed by switch state or exact code" },
          { name: 'Update', value: 'update', action: 'Update a coupon', description: 'Change a coupon. Fields you leave out keep their stored values.' },
        ],
        default: 'list',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['coupon'] } },
      },
      {
        displayName: 'Coupon ID',
        name: 'couponId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['coupon'], operation: ['get', 'update', 'delete', 'activate', 'deactivate'] } },
        description: 'UUID of the coupon',
      },
      {
        displayName: 'Code',
        name: 'code',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['coupon'], operation: ['create'] } },
        description: 'What subscribers type at checkout. Letters, numbers and dashes, 3-64 characters. Stored uppercase.',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['coupon'], operation: ['create'] } },
        description: 'Internal label to tell your codes apart, 3-255 characters',
      },
      {
        displayName: 'Discount Type',
        name: 'discountType',
        type: 'options',
        options: [
          { name: 'Fixed Amount', value: 'fixed', description: 'An amount off in one currency; only applies to plans priced in it' },
          { name: 'Percentage', value: 'percentage', description: 'A percentage off; works on plans in any currency' },
        ],
        default: 'percentage',
        required: true,
        displayOptions: { show: { resource: ['coupon'], operation: ['create'] } },
      },
      {
        displayName: 'Discount Value',
        name: 'discountValue',
        type: 'number',
        typeOptions: { numberPrecision: 2 },
        default: 10,
        required: true,
        displayOptions: { show: { resource: ['coupon'], operation: ['create'] } },
        description: 'For a percentage, 1-99. For a fixed amount, a value above zero in the chosen currency.',
      },
      {
        displayName: 'Additional Fields',
        name: 'couponFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['coupon'], operation: ['create'] } },
        options: [
          { displayName: 'Active', name: 'active', type: 'boolean', default: true, description: 'Whether the code is usable right away' },
          { displayName: 'Currency ID', name: 'currency_id', type: 'string', default: '', description: 'Currency UUID. Required for a fixed amount, ignored for a percentage.' },
          { displayName: 'Expires At', name: 'expires_at', type: 'dateTime', default: '', description: 'When the code stops working. Empty for no end date.' },
          { displayName: 'Max Redemptions', name: 'max_redemptions', type: 'number', typeOptions: { minValue: 1 }, default: 100, description: 'Total uses allowed across everyone. Leave the field out for unlimited.' },
          { displayName: 'Max Redemptions Per User', name: 'max_redemptions_per_user', type: 'number', typeOptions: { minValue: 1 }, default: 1, description: 'How many times one subscriber may use the code' },
          { displayName: 'Minimum Amount', name: 'minimum_amount', type: 'number', typeOptions: { numberPrecision: 2 }, default: 0, description: "Only apply the code when the plan costs at least this much, in the plan's own currency" },
          { displayName: 'Plan IDs', name: 'plan_ids', type: 'string', default: '', description: 'Comma-separated plan UUIDs to restrict the code to. Empty covers every plan in the project, including ones added later.' },
          { displayName: 'Starts At', name: 'starts_at', type: 'dateTime', default: '', description: 'When the code becomes usable. Empty starts immediately.' },
        ],
      },
      {
        displayName: 'Update Fields',
        name: 'couponUpdateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['coupon'], operation: ['update'] } },
        options: [
          { displayName: 'Active', name: 'active', type: 'boolean', default: true, description: 'Whether the code is usable' },
          { displayName: 'Code', name: 'code', type: 'string', default: '', description: 'Letters, numbers and dashes, 3-64 characters. Stored uppercase.' },
          { displayName: 'Currency ID', name: 'currency_id', type: 'string', default: '', description: 'Currency UUID. Required for a fixed amount, ignored for a percentage.' },
          {
            displayName: 'Discount Type',
            name: 'discount_type',
            type: 'options',
            options: [
              { name: 'Fixed Amount', value: 'fixed' },
              { name: 'Percentage', value: 'percentage' },
            ],
            default: 'percentage',
          },
          { displayName: 'Discount Value', name: 'discount_value', type: 'number', typeOptions: { numberPrecision: 2 }, default: 10, description: 'For a percentage, 1-99. For a fixed amount, a value above zero.' },
          { displayName: 'Expires At', name: 'expires_at', type: 'dateTime', default: '', description: 'Empty removes the end date' },
          { displayName: 'Max Redemptions', name: 'max_redemptions', type: 'number', typeOptions: { minValue: 1 }, default: 100, description: 'Raising it on an exhausted code makes it redeemable again' },
          { displayName: 'Max Redemptions Per User', name: 'max_redemptions_per_user', type: 'number', typeOptions: { minValue: 1 }, default: 1 },
          { displayName: 'Minimum Amount', name: 'minimum_amount', type: 'number', typeOptions: { numberPrecision: 2 }, default: 0 },
          { displayName: 'Name', name: 'name', type: 'string', default: '', description: 'Internal label, 3-255 characters' },
          { displayName: 'Plan IDs', name: 'plan_ids', type: 'string', default: '', description: 'Comma-separated plan UUIDs. Empty covers every plan in the project.' },
          { displayName: 'Starts At', name: 'starts_at', type: 'dateTime', default: '' },
        ],
      },
      {
        displayName: 'Filters',
        name: 'couponListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['coupon'], operation: ['list'] } },
        options: [
          { displayName: 'Active', name: 'active', type: 'boolean', default: true, description: 'Whether to return only codes that are switched on (or, when off, only codes that are switched off)' },
          { displayName: 'Code', name: 'code', type: 'string', default: '', description: 'Exact code to look up' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
        ],
      },

      // === CREATOR TASK ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['creatorTask'] } },
        options: [
          {
            name: 'Complete',
            value: 'complete',
            action: 'Complete a creator task',
            description: 'Mark a hand-arranged perk as handed over: the grant is issued and creator_task.completed then member.resource_added fire',
          },
          {
            name: 'List',
            value: 'list',
            action: 'List creator tasks',
            description: "List the hand-arranged perks a creator still has to hand over in a project (one task per subscriber and manual resource, oldest first), or the ones already done",
          },
        ],
        default: 'list',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['creatorTask'] } },
      },
      {
        displayName: 'Task ID',
        name: 'taskId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['creatorTask'], operation: ['complete'] } },
        description: 'UUID of the task, from List or the Creator Task — Opened event',
      },
      {
        displayName: 'Filters',
        name: 'creatorTaskListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['creatorTask'], operation: ['list'] } },
        options: [
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            options: [
              { name: 'Open', value: 'open', description: 'Not yet done, purchase still standing (the default)' },
              { name: 'Completed', value: 'completed' },
              { name: 'All', value: 'all' },
            ],
            default: 'open',
          },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
        ],
      },

      // === RECOVERY ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['recovery'] } },
        options: [
          {
            name: 'Get Allowances',
            value: 'allowances',
            action: 'Get recovery allowances',
            description: 'How many self-service Disaster Recoveries of each kind the creator may still run, what support has released on top, and when the allowance returns',
          },
          {
            name: 'Get Incident',
            value: 'getIncident',
            action: 'Get a recovery incident',
            description: 'Fetch one Disaster Recovery incident by UUID',
          },
          {
            name: 'Get Operation',
            value: 'getOperation',
            action: 'Get a recovery operation',
            description: 'Fetch one Disaster Recovery operation by UUID, with whether it can still be undone',
          },
          {
            name: 'Get Readiness',
            value: 'readiness',
            action: 'Get recovery readiness',
            description: 'The Disaster Recovery readiness checklist for the creator: every line with its state, and the totals',
          },
          {
            name: 'Get Roll Call',
            value: 'rollCall',
            action: 'Get a recovery roll call',
            description: 'Where the re-admission after one channel recovery stands: members re-admitted, joined, still outside, and whether a reminder may go out now',
          },
          {
            name: 'Get Settings',
            value: 'getSettings',
            action: 'Get recovery settings',
            description: "One project's Disaster Recovery settings: automatic failover and its fee consent, how members are told after a swap, whether a standby installation is kept",
          },
          {
            name: 'Get Standby',
            value: 'getStandby',
            action: 'Get a resource standby',
            description: 'The standby kept for one resource: health, mirror switch, when it was last probed and written to',
          },
          {
            name: 'List Incidents',
            value: 'listIncidents',
            action: 'List recovery incidents',
            description: 'What the health probes found broken (open by default), with the reason in the connector\'s words',
          },
          {
            name: 'List Operations',
            value: 'listOperations',
            action: 'List recovery operations',
            description: 'Every recovery ever run, by the creator, the platform or on demand, with its state and undo window',
          },
          {
            name: 'Notify Members',
            value: 'notifyMembers',
            action: 'Notify members of a recovery',
            description: 'Email every member the project can reach that its bot changed after a bot replacement, at the per-email fee; sent once per recovery',
          },
          {
            name: 'Nudge Pending Readmissions',
            value: 'nudge',
            action: 'Nudge pending readmissions',
            description: 'Remind, with a fresh link, every member a channel recovery re-admitted who has not joined yet',
          },
          {
            name: 'Remove Standby',
            value: 'removeStandby',
            action: 'Remove a resource standby',
            description: 'Stop keeping a standby for one resource; the chat itself is untouched',
          },
          {
            name: 'Remove Standby Installation',
            value: 'removeStandbyInstallation',
            action: 'Remove a standby installation',
            description: "Stop keeping the standby installation (the spare bot) registered for a project",
          },
          {
            name: 'Request Replacement',
            value: 'requestReplacement',
            action: 'Request a resource replacement',
            description: "Ask the creator, through the connector, to pick the chat that replaces a resource's; the swap runs when they choose",
          },
          {
            name: 'Request Standby',
            value: 'requestStandby',
            action: 'Request a resource standby',
            description: 'Ask the creator, through the connector, to pick the chat that becomes the standby for one resource',
          },
          {
            name: 'Revert',
            value: 'revert',
            action: 'Revert a recovery operation',
            description: 'Undo a completed recovery inside its window: a swapped channel put back (name the resource), or the previous sign-in account restored',
          },
          {
            name: 'Set Standby Mirror',
            value: 'setStandbyMirror',
            action: 'Set a resource standby mirror',
            description: "Switch the live mirror into a resource's standby on or off",
          },
          {
            name: 'Update Settings',
            value: 'updateSettings',
            action: 'Update recovery settings',
            description: 'Change automatic failover (with the fee consent) and how members are told after a swap; fields left out keep their value',
          },
          {
            name: 'Use Standby',
            value: 'useStandby',
            action: 'Use a resource standby',
            description: 'Swap a resource onto its standby now: old links revoked, every active member re-admitted, the standby consumed',
          },
          {
            name: 'Withdraw Replacement Request',
            value: 'withdrawReplacementRequest',
            action: 'Withdraw a resource replacement request',
            description: 'Take back the replacement request the creator has open on the connector',
          },
          {
            name: 'Withdraw Standby Request',
            value: 'withdrawStandbyRequest',
            action: 'Withdraw a resource standby request',
            description: 'Take back the standby request the creator has open on the connector',
          },
        ],
        default: 'listIncidents',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['recovery'], operation: ['getSettings', 'updateSettings', 'removeStandbyInstallation'] } },
      },
      {
        displayName: 'Resource ID',
        name: 'resourceId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['recovery'], operation: ['getStandby', 'requestStandby', 'withdrawStandbyRequest', 'useStandby', 'removeStandby', 'setStandbyMirror', 'requestReplacement', 'withdrawReplacementRequest'] } },
        description: 'UUID of the resource; the withdraw operations take back the creator\'s open request whichever resource it was for',
      },
      {
        displayName: 'Mirror',
        name: 'mirror',
        type: 'boolean',
        default: true,
        displayOptions: { show: { resource: ['recovery'], operation: ['setStandbyMirror'] } },
        description: 'Whether every post is copied into the standby as it is made',
      },
      {
        displayName: 'Resource ID (Channel Recovery)',
        name: 'revertResourceId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['recovery'], operation: ['revert'] } },
        description: 'For a channel recovery, the resource to put back on its old chat. Leave blank for an account relink.',
      },
      {
        displayName: 'Settings',
        name: 'recoverySettingsFields',
        type: 'collection',
        placeholder: 'Add Setting',
        default: {},
        displayOptions: { show: { resource: ['recovery'], operation: ['updateSettings'] } },
        options: [
          { displayName: 'Auto Failover', name: 'autoFailover', type: 'boolean', default: false, description: 'Whether the platform may swap a banned channel for its standby on its own' },
          { displayName: 'Accepts Email Fee', name: 'acceptsEmailFee', type: 'boolean', default: false, description: 'Whether the creator accepts the per-email fee a failover may charge; required when switching failover on' },
          {
            displayName: 'Email Delivery',
            name: 'emailDelivery',
            type: 'options',
            options: [
              { name: 'Self', value: 'self', description: 'The creator tells members after a swap' },
              { name: 'Platform', value: 'platform', description: 'Subscriby emails members at the per-email fee' },
            ],
            default: 'self',
          },
        ],
      },
      {
        displayName: 'Incident ID',
        name: 'incidentId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['recovery'], operation: ['getIncident'] } },
        description: 'UUID of the incident, from List Incidents',
      },
      {
        displayName: 'Operation ID',
        name: 'operationId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['recovery'], operation: ['getOperation', 'rollCall', 'revert', 'nudge', 'notifyMembers'] } },
        description: 'UUID of the recovery operation, from List Operations',
      },
      {
        displayName: 'Filters',
        name: 'recoveryIncidentFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['recovery'], operation: ['listIncidents'] } },
        options: [
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            options: [
              { name: 'Open', value: 'open', description: 'Still needing attention (the default)' },
              { name: 'Resolved', value: 'resolved' },
              { name: 'All', value: 'all' },
            ],
            default: 'open',
          },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
        ],
      },
      {
        displayName: 'Filters',
        name: 'recoveryOperationFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['recovery'], operation: ['listOperations'] } },
        options: [
          {
            displayName: 'Kind',
            name: 'kind',
            type: 'options',
            options: [
              { name: 'Account', value: 'account' },
              { name: 'Bot', value: 'bot' },
              { name: 'Channels & Groups', value: 'resources' },
            ],
            default: 'resources',
          },
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            options: [
              { name: 'In Progress', value: 'started' },
              { name: 'Completed', value: 'completed' },
              { name: 'Failed', value: 'failed' },
              { name: 'Reverted', value: 'reverted' },
            ],
            default: 'completed',
          },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
        ],
      },

      // === RESOURCE ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['resource'] } },
        options: [
          { name: 'Activate', value: 'activate', action: 'Activate a resource', description: 'Switch a resource back on so it is delivered to members' },
          { name: 'Create', value: 'create', action: 'Create a resource', description: 'Attach an external deliverable to a project' },
          { name: 'Deactivate', value: 'deactivate', action: 'Deactivate a resource', description: 'Switch a resource off without deleting it; new members stop receiving it' },
          { name: 'Delete', value: 'delete', action: 'Delete a resource', description: 'Permanently delete a resource' },
          { name: 'Get', value: 'get', action: 'Get a resource', description: 'Fetch a resource by UUID' },
          { name: 'List', value: 'list', action: 'List resources', description: 'List all resources attached to a project' },
          { name: 'Unlink', value: 'unlink', action: 'Unlink a resource', description: 'Detach a resource from delivery without deleting it' },
          { name: 'Update', value: 'update', action: 'Update a resource', description: 'Change the title, description or switch. Fields you leave out keep their stored values.' },
        ],
        default: 'create',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['resource'] } },
      },
      {
        displayName: 'Resource ID',
        name: 'resourceId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['resource'], operation: ['get', 'unlink', 'delete', 'update', 'activate', 'deactivate'] } },
        description: 'UUID of the resource',
      },
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['resource'], operation: ['create'] } },
      },
      {
        displayName: 'Type',
        name: 'type',
        type: 'options',
        options: [
          { name: 'Telegram Chat', value: 'telegram_chat' },
          { name: 'Telegram Channel', value: 'telegram_channel' },
          { name: 'Link', value: 'link' },
        ],
        default: 'telegram_chat',
        required: true,
        displayOptions: { show: { resource: ['resource'], operation: ['create'] } },
      },
      {
        displayName: 'Target',
        name: 'target',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['resource'], operation: ['create'] } },
        description: 'Chat ID, channel username, or URL — depending on the resource type',
      },

      {
        displayName: 'Update Fields',
        name: 'resourceUpdateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['resource'], operation: ['update'] } },
        options: [
          { displayName: 'Active', name: 'active', type: 'boolean', default: true, description: 'Whether the resource is delivered to members' },
          { displayName: 'Description', name: 'description', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Up to 1000 characters of well-formed HTML. Leave the field out to keep the stored description.' },
          { displayName: 'Title', name: 'title', type: 'string', default: '', description: '5-255 characters' },
        ],
      },

      // === PAYMENT METHOD ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['paymentMethod'] } },
        options: [
          { name: 'Activate', value: 'activate', action: 'Activate a payment method', description: 'Offer the gateway at checkout again. A Stripe method whose Connect onboarding never finished is refused.' },
          { name: 'Deactivate', value: 'deactivate', action: 'Deactivate a payment method', description: 'Stop offering the gateway at checkout; existing subscriptions keep billing' },
          { name: 'Delete', value: 'delete', action: 'Delete a payment method', description: 'Remove the gateway from the project' },
          { name: 'Get', value: 'get', action: 'Get a payment method', description: 'Fetch a payment method by UUID' },
          { name: 'List', value: 'list', action: 'List payment methods', description: 'List all payment methods for a project' },
          { name: 'Sync Plans', value: 'sync', action: 'Sync plans to a payment method', description: "Queue a re-sync of the project's plans to the gateway. Answers 202 once the job is queued." },
        ],
        default: 'list',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['paymentMethod'] } },
      },
      {
        displayName: 'Method ID',
        name: 'methodId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['paymentMethod'], operation: ['get', 'activate', 'deactivate', 'sync', 'delete'] } },
        description: 'UUID of the payment method',
      },

      // === WEBHOOK ENDPOINT ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['webhookEndpoint'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a webhook endpoint', description: 'Register a new webhook endpoint' },
          { name: 'Delete', value: 'delete', action: 'Delete a webhook endpoint', description: 'Remove a webhook endpoint' },
          { name: 'Get', value: 'get', action: 'Get a webhook endpoint', description: 'Fetch one webhook endpoint by UUID' },
          { name: 'List', value: 'list', action: 'List webhook endpoints', description: 'List all webhook endpoints for the current team' },
          { name: 'Pause', value: 'pause', action: 'Pause a webhook endpoint', description: 'Stop deliveries to the endpoint without deleting it' },
          { name: 'Resume', value: 'resume', action: 'Resume a webhook endpoint', description: 'Restart deliveries to a paused endpoint' },
          { name: 'Rotate Secret', value: 'rotateSecret', action: 'Rotate the signing secret', description: 'Rotate the HMAC signing secret for a webhook endpoint' },
          { name: 'Test', value: 'test', action: 'Send a test delivery', description: 'Trigger a test delivery from Subscriby to the endpoint' },
        ],
        default: 'list',
      },
      {
        displayName: 'Endpoint ID',
        name: 'endpointId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['delete', 'rotateSecret', 'test', 'get', 'pause', 'resume'] } },
        description: 'UUID of the webhook endpoint',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['create'] } },
        description: 'Human-readable label for the endpoint',
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['create'] } },
        description: 'HTTPS URL that will receive event deliveries',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['create'] } },
        description: 'Comma-separated list of event types to subscribe to (e.g. subscription.created,payment.succeeded)',
      },
      {
        displayName: 'Additional Fields',
        name: 'webhookEndpointFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['create'] } },
        options: [
          { displayName: 'Project ID', name: 'project_id', type: 'string', default: '', description: 'Restrict deliveries to a single project' },
          { displayName: 'Allowed IPs', name: 'allowed_ips', type: 'string', default: '', description: 'Comma-separated list of IP addresses or CIDR ranges the endpoint host may resolve to; a delivery whose host resolves outside the list is dead-lettered without being posted' },
          { displayName: 'Is Active', name: 'is_active', type: 'boolean', default: true },
        ],
      },

      // === WEBHOOK DELIVERY ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['webhookDelivery'] } },
        options: [
          { name: 'Get', value: 'get', action: 'Get a webhook delivery', description: 'Fetch one delivery by UUID, with the payload the endpoint received and the last response' },
          { name: 'List', value: 'list', action: 'List webhook deliveries', description: "List the team's delivery log, newest first, optionally narrowed by status" },
          { name: 'Retry', value: 'retry', action: 'Retry a webhook delivery', description: 'Queue a failed or dead-lettered delivery again. Pending and delivered rows are refused.' },
          { name: 'Retry Dead', value: 'retryDead', action: 'Retry dead lettered deliveries', description: 'Queue every dead-lettered delivery since a point in time again' },
        ],
        default: 'list',
      },
      {
        displayName: 'Delivery ID',
        name: 'deliveryId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookDelivery'], operation: ['get', 'retry'] } },
        description: 'UUID of the delivery',
      },
      {
        displayName: 'Since',
        name: 'since',
        type: 'dateTime',
        default: '',
        displayOptions: { show: { resource: ['webhookDelivery'], operation: ['retryDead'] } },
        description: 'Only dead-lettered deliveries that failed at or after this time. Empty means the last 24 hours.',
      },
      {
        displayName: 'Filters',
        name: 'webhookDeliveryFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['webhookDelivery'], operation: ['list'] } },
        options: [
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            options: [
              { name: 'All', value: 'all' },
              { name: 'Dead', value: 'dead', description: 'Gave up after the retry ladder' },
              { name: 'Delivered', value: 'delivered' },
              { name: 'Failed', value: 'failed', description: 'Waiting for the next retry' },
              { name: 'Pending', value: 'pending' },
            ],
            default: 'all',
          },
        ],
      },

      // === ACCOUNT ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['account'] } },
        options: [
          {
            name: 'Get Me',
            value: 'getMe',
            action: 'Get the current account',
            description:
              'Fetch the creator the API token belongs to: the team it is scoped to, every team held, plan capabilities, connected accounts and alert destinations',
          },
        ],
        default: 'getMe',
      },

      // === TOKEN ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['token'] } },
        options: [
          { name: 'List', value: 'list', action: 'List API tokens', description: 'List all API tokens for the current team' },
          { name: 'Get', value: 'get', action: 'Get an API token', description: 'Fetch an API token by UUID' },
          { name: 'Revoke', value: 'revoke', action: 'Revoke an API token', description: 'Revoke an API token immediately' },
        ],
        default: 'list',
      },
      {
        displayName: 'Token ID',
        name: 'tokenId',
        type: 'string',
								typeOptions: { password: true },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['token'], operation: ['get', 'revoke'] } },
        description: 'UUID of the API token',
      },

      // === TEAM ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['team'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a team', description: 'Create a team. Growth tier only.' },
          { name: 'Delete', value: 'delete', action: 'Delete a team', description: 'Permanently delete a team and everything scoped to it. Owner only.' },
          { name: 'Get', value: 'get', action: 'Get a team', description: 'Fetch a team by UUID' },
          { name: 'Get Current', value: 'getCurrent', action: 'Get the current team', description: 'Fetch the team that owns the API token' },
          { name: 'List', value: 'list', action: 'List teams', description: 'List all teams the caller belongs to' },
          { name: 'Update', value: 'update', action: 'Update a team', description: 'Rename a team. Owner only.' },
        ],
        default: 'list',
      },
      {
        displayName: 'Team ID',
        name: 'teamId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['team'], operation: ['get', 'update', 'delete'] } },
        description: 'UUID of the team',
      },
      {
        displayName: 'Name',
        name: 'teamName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['team'], operation: ['create', 'update'] } },
        description: 'Team name, up to 255 characters',
      },

      // === TEAM MEMBER ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['teamMember'] } },
        options: [
          { name: 'Cancel Invitation', value: 'cancelInvitation', action: 'Cancel a team invitation', description: 'Withdraw an invitation nobody has accepted yet' },
          { name: 'Get', value: 'get', action: 'Get a team member', description: 'Fetch a single team member' },
          { name: 'Invite', value: 'invite', action: 'Invite a team member', description: 'Invite someone by email to an existing role on the team' },
          { name: 'List', value: 'list', action: 'List team members', description: 'List all members of a team' },
          { name: 'Remove', value: 'remove', action: 'Remove a team member', description: 'Remove a collaborator from the team. The owner cannot be removed.' },
          { name: 'Update Role', value: 'updateRole', action: 'Change a team member role', description: 'Move a collaborator onto a different role. The owner cannot be re-roled.' },
        ],
        default: 'list',
      },
      {
        displayName: 'Email',
        name: 'memberEmail',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['teamMember'], operation: ['invite'] } },
        description: 'Email address of the person being invited. They do not need an account yet.',
      },
      {
        displayName: 'Role Code',
        name: 'memberRole',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['teamMember'], operation: ['invite', 'updateRole'] } },
        description: 'Code of an existing role on that team, for example support-agent. Not the role UUID.',
      },
      {
        displayName: 'Invitation ID',
        name: 'invitationId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['teamMember'], operation: ['cancelInvitation'] } },
        description: 'UUID of the pending invitation to withdraw',
      },
      {
        displayName: 'Team ID',
        name: 'teamId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['teamMember'] } },
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['teamMember'], operation: ['get'] } },
        description: 'UUID of the team member (user)',
      },

      // === ROLE ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['role'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a role', description: 'Create a permission role in a team. Growth tier only.' },
          { name: 'Delete', value: 'delete', action: 'Delete a role', description: 'Delete a role. Creator only, unless you own the team.' },
          { name: 'Get', value: 'get', action: 'Get a role', description: 'Fetch a role by UUID' },
          { name: 'List', value: 'list', action: 'List roles', description: 'List all roles defined for the current team' },
          { name: 'Update', value: 'update', action: 'Update a role', description: 'Rename a role and replace its permissions' },
        ],
        default: 'list',
      },
      {
        displayName: 'Role ID',
        name: 'roleId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['role'], operation: ['get', 'update', 'delete'] } },
        description: 'UUID of the role',
      },
      {
        displayName: 'Team ID',
        name: 'roleTeamId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['role'], operation: ['create'] } },
        description: 'UUID of the team the role belongs to',
      },
      {
        displayName: 'Code',
        name: 'roleCode',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['role'], operation: ['create'] } },
        description: 'Stable identifier, letters/numbers/dashes. Unique per team and immutable once created.',
      },
      {
        displayName: 'Name',
        name: 'roleName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['role'], operation: ['create'] } },
        description: 'Human-readable role name',
      },
      {
        displayName: 'Update Fields',
        name: 'roleUpdateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['role'], operation: ['update'] } },
        options: [
          { displayName: 'Name', name: 'name', type: 'string', default: '', description: 'New role name' },
          { displayName: 'Description', name: 'description', type: 'string', default: '', description: 'New role description' },
          {
            displayName: 'Permissions',
            name: 'permissions',
            type: 'string',
            default: '',
            description: 'Comma-separated permission codes in entity:action form. REPLACES the existing set — omit this field to leave permissions untouched.',
          },
        ],
      },
      {
        displayName: 'Permissions',
        name: 'rolePermissions',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['role'], operation: ['create'] } },
        description: 'Comma-separated permission codes in entity:action form, for example project:view-any',
      },
      {
        displayName: 'Description',
        name: 'roleDescription',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['role'], operation: ['create'] } },
        description: 'Optional note on what the role is for',
      },

      // === GROUP ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['group'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a group', description: 'Create a permission group in a team. Growth tier only.' },
          { name: 'Delete', value: 'delete', action: 'Delete a group', description: 'Delete a group. Members stay in the team.' },
          { name: 'Get', value: 'get', action: 'Get a group', description: 'Fetch a group by UUID' },
          { name: 'List', value: 'list', action: 'List groups', description: 'List all groups for the current team' },
          { name: 'Sync Members', value: 'syncMembers', action: 'Sync group members', description: 'Replace the membership wholesale. Anyone left out is removed.' },
          { name: 'Update', value: 'update', action: 'Update a group', description: 'Rename a group and replace its permissions' },
        ],
        default: 'list',
      },
      {
        displayName: 'Group ID',
        name: 'groupId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['group'], operation: ['get', 'update', 'delete', 'syncMembers'] } },
        description: 'UUID of the group',
      },
      {
        displayName: 'Team ID',
        name: 'groupTeamId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['group'], operation: ['create'] } },
        description: 'UUID of the team the group belongs to',
      },
      {
        displayName: 'Code',
        name: 'groupCode',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['group'], operation: ['create'] } },
        description: 'Stable identifier, letters/numbers/dashes. Unique per team and immutable once created.',
      },
      {
        displayName: 'Name',
        name: 'groupName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['group'], operation: ['create'] } },
        description: 'Human-readable group name',
      },
      {
        displayName: 'Permissions',
        name: 'groupPermissions',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['group'], operation: ['create'] } },
        description: 'Comma-separated permission codes in entity:action form',
      },
      {
        displayName: 'Update Fields',
        name: 'groupUpdateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['group'], operation: ['update'] } },
        options: [
          { displayName: 'Name', name: 'name', type: 'string', default: '', description: 'New group name' },
          {
            displayName: 'Permissions',
            name: 'permissions',
            type: 'string',
            default: '',
            description: 'Comma-separated permission codes. REPLACES the existing set — omit this field to leave permissions untouched.',
          },
        ],
      },
      {
        displayName: 'Member User IDs',
        name: 'groupMemberIds',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['group'], operation: ['syncMembers'] } },
        description: 'Comma-separated user UUIDs the group should contain. This is a SYNC — anyone not listed is removed, and an empty value clears the group.',
      },

      // === ACTIVITY ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['activity'] } },
        options: [
          { name: 'List', value: 'list', action: 'List activity log entries', description: 'List activity log entries for a subject' },
        ],
        default: 'list',
      },
      {
        displayName: 'Subject Type',
        name: 'subjectType',
        type: 'options',
        options: [
          { name: 'Access Code', value: 'access-code' },
          { name: 'Member', value: 'member' },
          { name: 'Plan', value: 'plan' },
          { name: 'Project', value: 'project' },
          { name: 'Subscription', value: 'subscription' },
        ],
        default: 'project',
        required: true,
        displayOptions: { show: { resource: ['activity'], operation: ['list'] } },
      },
      {
        displayName: 'Subject ID',
        name: 'subjectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['activity'], operation: ['list'] } },
        description: 'UUID of the subject to query activity for',
      },
      {
        displayName: 'Limit',
        name: 'activityLimit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 200 },
        default: 50,
        displayOptions: { show: { resource: ['activity'], operation: ['list'] } },
      },

      // === BOT ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['bot'] } },
        options: [
          { name: 'Disconnect', value: 'disconnect', action: 'Disconnect the bot', description: 'Detach the Telegram bot from the project. Members keep their access; the bot stops answering for this project.' },
          { name: 'Get Status', value: 'getStatus', action: 'Get bot status', description: 'Fetch the current bot connection status for a project' },
        ],
        default: 'getStatus',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['bot'] } },
      },

      // === CONNECTOR ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['connector'] } },
        options: [
          { name: 'Get', value: 'get', action: 'Get a connector', description: 'Fetch one Connector Directory card by key: its lane, badges, manifest and the form that connects it' },
          { name: 'Get Installation', value: 'getInstallation', action: 'Get a connector installation', description: "Fetch a project's live installation of one connector, with its state and health" },
          { name: 'List', value: 'list', action: 'List connectors', description: 'List the Connector Directory: every connector Subscriby knows, lane by lane, with its badges, manifest and connect form' },
          { name: 'List Installations', value: 'listInstallations', action: 'List connector installations', description: 'List every connector installation a project holds, live and standby, with its state and health' },
        ],
        default: 'list',
      },
      {
        displayName: 'Connector Key',
        name: 'connectorKey',
        type: 'string',
        default: '',
        required: true,
        description: 'The connector key as the List operation returns it, for example telegram',
        displayOptions: { show: { resource: ['connector'], operation: ['get', 'getInstallation'] } },
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['connector'], operation: ['listInstallations', 'getInstallation'] } },
      },
      {
        displayName: 'Status',
        name: 'connectorStatus',
        type: 'options',
        options: [
          { name: 'All Lanes', value: '' },
          { name: 'Available Now', value: 'available' },
          { name: 'Coming Soon', value: 'coming_soon' },
          { name: 'Experimental', value: 'beta' },
          { name: 'Paused', value: 'paused' },
          { name: 'Under Development', value: 'in_development' },
        ],
        default: '',
        description: 'Narrow the directory to one lane',
        displayOptions: { show: { resource: ['connector'], operation: ['list'] } },
      },

      // === DISTRIBUTION ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['distribution'] } },
        options: [
          { name: 'Get Bot Link', value: 'getBotLink', action: 'Get bot link', description: 'Fetch the Telegram bot link for a project' },
          { name: 'Get Portal URL', value: 'getPortalUrl', action: 'Get portal URL', description: 'Fetch the public portal URL for a project' },
          { name: 'Get Deep Link', value: 'getDeepLink', action: 'Get a deep link', description: 'Generate a Telegram deep link targeting an access code, plan, or custom payload' },
        ],
        default: 'getBotLink',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['distribution'] } },
      },
      {
        displayName: 'Deep Link Target',
        name: 'deepLinkTarget',
        type: 'collection',
        placeholder: 'Add Target',
        default: {},
        displayOptions: { show: { resource: ['distribution'], operation: ['getDeepLink'] } },
        description: 'Provide exactly one of access_code, plan_id, or custom',
        options: [
          { displayName: 'Access Code', name: 'access_code', type: 'string', default: '' },
          { displayName: 'Plan ID', name: 'plan_id', type: 'string', default: '' },
          { displayName: 'Custom', name: 'custom', type: 'string', default: '' },
        ],
      },

      // === ANALYTICS ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['analytics'] } },
        options: [
          { name: 'Get Dashboard', value: 'getDashboard', action: 'Get dashboard analytics', description: 'Fetch aggregated dashboard metrics' },
          { name: 'Get Earnings', value: 'getEarnings', action: 'Get earnings analytics', description: 'Fetch earnings time-series data' },
          { name: 'Get Plan Performance', value: 'getPlanPerformance', action: 'Get plan performance', description: 'Fetch per-plan performance analytics for a project' },
          { name: 'Get Subscribers', value: 'getSubscribers', action: 'Get subscriber analytics', description: 'Fetch subscriber growth analytics' },
          { name: 'Get Transaction Breakdown', value: 'getTransactionBreakdown', action: 'Get transaction breakdown', description: 'Fetch a transaction breakdown by dimension' },
          { name: 'List Transactions', value: 'listTransactions', action: 'List transactions', description: 'List raw transactions for a project' },
        ],
        default: 'getDashboard',
      },
      {
        displayName: 'Project ID',
        name: 'analyticsProjectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['analytics'], operation: ['getPlanPerformance', 'listTransactions'] } },
      },
      {
        displayName: 'Dimension',
        name: 'dimension',
        type: 'options',
        options: [
          { name: 'Plan', value: 'plan' },
          { name: 'Payment Provider', value: 'payment_provider' },
          { name: 'Currency', value: 'currency' },
          { name: 'Project', value: 'project' },
        ],
        default: 'plan',
        required: true,
        displayOptions: { show: { resource: ['analytics'], operation: ['getTransactionBreakdown'] } },
      },
      {
        displayName: 'Granularity',
        name: 'granularity',
        type: 'options',
        options: [
          { name: 'Day', value: 'day' },
          { name: 'Week', value: 'week' },
          { name: 'Month', value: 'month' },
        ],
        default: 'day',
        displayOptions: { show: { resource: ['analytics'], operation: ['getEarnings'] } },
      },
      {
        displayName: 'Additional Fields',
        name: 'analyticsFilters',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: {
            resource: ['analytics'],
            operation: [
              'getDashboard',
              'getEarnings',
              'getSubscribers',
              'getTransactionBreakdown',
              'getPlanPerformance',
              'listTransactions',
            ],
          },
        },
        options: [
          { displayName: 'Compare Period', name: 'compare_period', type: 'string', default: '', description: 'Comparison window (e.g. prev_period)' },
          { displayName: 'Cursor', name: 'cursor', type: 'string', default: '', description: 'Opaque pagination cursor' },
          { displayName: 'From', name: 'from', type: 'string', default: '', description: 'ISO 8601 start date' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Period', name: 'period', type: 'string', default: '', description: 'Pre-set period like 7d, 30d, mtd, ytd' },
          { displayName: 'Project ID', name: 'project_id', type: 'string', default: '', description: 'Scope to a single project (where optional)' },
          { displayName: 'To', name: 'to', type: 'string', default: '', description: 'ISO 8601 end date' },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;

        const response = await dispatch.call(this, resource, operation, i);
        const payload = extractData(response);

        if (Array.isArray(payload)) {
          for (const row of payload) {
            returnData.push({ json: row as IDataObject, pairedItem: { item: i } });
          }
        } else {
          returnData.push({ json: payload, pairedItem: { item: i } });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw toNodeError(this.getNode(), error);
      }
    }

    return [returnData];
  }
}

async function dispatch(
  this: IExecuteFunctions,
  resource: string,
  operation: string,
  i: number,
): Promise<IDataObject> {
  switch (resource) {
    case 'project':
      return dispatchProject.call(this, operation, i);
    case 'passWindow':
      return dispatchPassWindow.call(this, operation, i);
    case 'plan':
      return dispatchPlan.call(this, operation, i);
    case 'broadcast':
      return dispatchBroadcast.call(this, operation, i);
    case 'subscription':
      return dispatchSubscription.call(this, operation, i);
    case 'member':
      return dispatchMember.call(this, operation, i);
    case 'supportConversation':
      return dispatchSupportConversation.call(this, operation, i);
    case 'cannedReply':
      return dispatchCannedReply.call(this, operation, i);
    case 'supportSettings':
      return dispatchSupportSettings.call(this, operation, i);
    case 'coupon':
      return dispatchCoupon.call(this, operation, i);
    case 'creatorTask':
      return dispatchCreatorTask.call(this, operation, i);
    case 'recovery':
      return dispatchRecovery.call(this, operation, i);
    case 'subscriber':
      return dispatchSubscriber.call(this, operation, i);
    case 'accessCode':
      return dispatchAccessCode.call(this, operation, i);
    case 'resource':
      return dispatchResource.call(this, operation, i);
    case 'paymentMethod':
      return dispatchPaymentMethod.call(this, operation, i);
    case 'webhookEndpoint':
      return dispatchWebhookEndpoint.call(this, operation, i);
    case 'webhookDelivery':
      return dispatchWebhookDelivery.call(this, operation, i);
    case 'token':
      return dispatchToken.call(this, operation, i);
    case 'account':
      return dispatchAccount.call(this, operation);
    case 'team':
      return dispatchTeam.call(this, operation, i);
    case 'teamMember':
      return dispatchTeamMember.call(this, operation, i);
    case 'role':
      return dispatchRole.call(this, operation, i);
    case 'group':
      return dispatchGroup.call(this, operation, i);
    case 'activity':
      return dispatchActivity.call(this, operation, i);
    case 'bot':
      return dispatchBot.call(this, operation, i);
    case 'connector':
      return dispatchConnector.call(this, operation, i);
    case 'distribution':
      return dispatchDistribution.call(this, operation, i);
    case 'analytics':
      return dispatchAnalytics.call(this, operation, i);
    default:
      throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
  }
}

async function dispatchProject(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'create') {
    const body = compactBody({
      name: this.getNodeParameter('name', i) as string,
      handle: this.getNodeParameter('handle', i) as string,
      platform: this.getNodeParameter('platform', i) as string,
    });
    return subscribyApiRequest.call(this, 'POST', '/projects', body);
  }

  if (operation === 'update') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
    return subscribyApiRequest.call(this, 'PATCH', `/projects/${projectId}`, compactBody(updateFields));
  }

  if (operation === 'archive') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/archive`);
  }

  if (operation === 'restore') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/restore`);
  }

  if (operation === 'delete') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}`);
  }

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/projects');
    return { data: rows };
  }

  if (operation === 'get') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}`);
  }

  if (operation === 'findByHandle') {
    const handle = this.getNodeParameter('handle', i) as string;
    return subscribyApiRequest.call(this, 'GET', '/projects', undefined, { handle });
  }

  throw new NodeOperationError(this.getNode(), `Unknown project operation: ${operation}`);
}

/**
 * The dated access windows a project's pass plans generate.
 *
 * Read-only. A Pass Series points at windows that already exist rather than
 * creating any, so this is where its window IDs come from — without it a series
 * cannot be authored from n8n at all.
 */
async function dispatchPassWindow(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const filters = compactBody(this.getNodeParameter('filters', i, {}) as IDataObject);

    const rows = await subscribyApiRequestAllItems.call(
      this,
      'GET',
      `/projects/${projectId}/pass-windows`,
      filters,
    );

    return { data: rows };
  }

  if (operation === 'create') {
    const planId = this.getNodeParameter('planId', i) as string;
    const body: IDataObject = {
      starts_at: this.getNodeParameter('startsAt', i) as string,
      duration_minutes: this.getNodeParameter('durationMinutes', i) as number,
    };

    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/plans/${planId}/pass-windows`, body);
  }

  const windowId = this.getNodeParameter('windowId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/pass-windows/${windowId}`);
  }

  if (operation === 'cancel' || operation === 'remindQueue') {
    const verb = operation === 'cancel' ? 'cancel' : 'remind';
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/pass-windows/${windowId}/${verb}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown pass window operation: ${operation}`);
}

/**
 * Split a comma-separated list of ids into an array, dropping blanks.
 *
 * n8n has no plain string-list input, so multi-id fields are typed by hand.
 */
function idList(raw: string): string[] {
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Assemble the kind-discriminated body a plan write expects.
 *
 * The Subscriby API takes `kind` plus exactly ONE nested object named after it,
 * and refuses a block belonging to another kind rather than ignoring it. n8n
 * properties are flat and gated by `displayOptions`, so only the chosen kind's
 * fields are ever on screen — this turns them into the nested shape.
 *
 * The previous version of this function sent `currency` instead of
 * `currency_id`, a `billing_cycle` enum the API does not accept, and never sent
 * the required `resources`, so every plan:create call 422'd.
 *
 * `sales_cap` rides at the top level beside `kind`. n8n cannot leave a number
 * unset, so `0` stands for "no limit" on create and is left out; on update it
 * means "lift the cap", which the API only accepts as an explicit `null`.
 */
function buildPlanBody(this: IExecuteFunctions, i: number, isCreate: boolean): IDataObject {
  const kind = this.getNodeParameter('kind', i, 'subscription') as string;
  const body: IDataObject = { kind };

  if (isCreate) {
    body.name = this.getNodeParameter('name', i) as string;
    body.currency_id = this.getNodeParameter('currencyId', i) as string;
    body.price = this.getNodeParameter('price', i) as number;

    const resources = idList(this.getNodeParameter('resources', i, '') as string);

    if (resources.length > 0) {
      body.resources = resources;
    }

    const salesCap = this.getNodeParameter('salesCap', i, 0) as number;

    if (salesCap > 0) {
      body.sales_cap = salesCap;
    }
  } else {
    Object.assign(body, compactBody(this.getNodeParameter('updateFields', i, {}) as IDataObject));

    if (body.sales_cap === 0) {
      body.sales_cap = null;
    }
  }

  if (kind === 'subscription') {
    const billing = compactBody(this.getNodeParameter('billing', i, {}) as IDataObject);

    if (Object.keys(billing).length > 0) {
      body.billing = billing;
    }

    return body;
  }

  if (kind === 'pass') {
    const pass = compactBody(this.getNodeParameter('pass', i, {}) as IDataObject);

    const slots = (this.getNodeParameter('passSlots.slot', i, []) as IDataObject[])
      .map((slot) => compactBody(slot));

    if (slots.length > 0) {
      pass.slots = slots;
    }

    if (Object.keys(pass).length > 0) {
      body.pass = pass;
    }

    return body;
  }

  const series = compactBody(this.getNodeParameter('passSeries', i, {}) as IDataObject);

  /*
   * Typed as a comma-separated string in the collection above, so it arrives
   * here as one value rather than the array the API wants.
   */
  if (typeof series.blackout_window_ids === 'string') {
    const excluded = idList(series.blackout_window_ids);

    if (excluded.length > 0) {
      series.blackout_window_ids = excluded;
    } else {
      delete series.blackout_window_ids;
    }
  }

  const windowIds = idList(this.getNodeParameter('seriesWindowIds', i, '') as string);

  if (windowIds.length > 0) {
    series.window_ids = windowIds;
  }

  const rules = (this.getNodeParameter('seriesRules.rule', i, []) as IDataObject[])
    .map((rule) => compactBody(rule));

  if (rules.length > 0) {
    series.rules = rules;
  }

  if (Object.keys(series).length > 0) {
    body.pass_series = series;
  }

  return body;
}

async function dispatchPlan(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'create') {
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/plans`,
      buildPlanBody.call(this, i, true),
    );
  }

  if (operation === 'update') {
    const planId = this.getNodeParameter('planId', i) as string;

    return subscribyApiRequest.call(
      this,
      'PATCH',
      `/projects/${projectId}/plans/${planId}`,
      buildPlanBody.call(this, i, false),
    );
  }

  if (operation === 'publish' || operation === 'unpublish') {
    const planId = this.getNodeParameter('planId', i) as string;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/plans/${planId}/${operation}`,
    );
  }

  if (operation === 'get') {
    const planId = this.getNodeParameter('planId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/plans/${planId}`);
  }

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/plans`);
    return { data: rows };
  }

  if (operation === 'delete') {
    const planId = this.getNodeParameter('planId', i) as string;
    return subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}/plans/${planId}`);
  }

  if (operation === 'findByName') {
    const planName = this.getNodeParameter('planName', i) as string;
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/plans`,
      undefined,
      { name: planName },
    );
  }

  if (operation === 'reorder') {
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/plans/order`, {
      plan_ids: idList(this.getNodeParameter('planIds', i, '') as string),
    });
  }

  if (operation === 'startNextSeason') {
    const planId = this.getNodeParameter('planId', i) as string;
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/plans/${planId}/successor`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown plan operation: ${operation}`);
}

async function dispatchSubscription(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'pause' || operation === 'unpause' || operation === 'reactivate' || operation === 'remind') {
    const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;

    return subscribyApiRequest.call(
      this,
      'POST',
      `/subscriptions/${subscriptionId}/${operation}`,
    );
  }

  if (operation === 'listGrants') {
    const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;

    return subscribyApiRequest.call(this, 'GET', `/subscriptions/${subscriptionId}/grants`);
  }

  if (operation === 'reissueGrants') {
    const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;
    const resourceId = this.getNodeParameter('grantResourceId', i, '') as string;
    const body: IDataObject = {};
    if (resourceId) {
      body.resource_id = resourceId;
    }

    return subscribyApiRequest.call(this, 'POST', `/subscriptions/${subscriptionId}/grants/reissue`, body);
  }

  if (operation === 'list') {
    const filters = this.getNodeParameter('subscriptionListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.planId) {
      qs.plan_id = filters.planId;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/subscriptions', qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', '/subscriptions', undefined, qs);
  }

  const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;

  if (operation === 'cancel') {
    const atPeriodEnd = this.getNodeParameter('atPeriodEnd', i) as boolean;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/subscriptions/${subscriptionId}/cancel`,
      { at_period_end: atPeriodEnd },
    );
  }

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/subscriptions/${subscriptionId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown subscription operation: ${operation}`);
}

async function dispatchSupportConversation(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const filters = this.getNodeParameter('supportConversationListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.projectId) {
      qs.project_id = filters.projectId;
    }
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.assignedTo) {
      qs.assigned_to = filters.assignedTo;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/support/conversations', qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', '/support/conversations', undefined, qs);
  }

  const conversationId = this.getNodeParameter('conversationId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/support/conversations/${conversationId}`);
  }

  if (operation === 'listMessages') {
    const filters = this.getNodeParameter('supportConversationListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(
        this,
        'GET',
        `/support/conversations/${conversationId}/messages`,
        qs,
      );
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(
      this,
      'GET',
      `/support/conversations/${conversationId}/messages`,
      undefined,
      qs,
    );
  }

  if (operation === 'reply') {
    const payload: IDataObject = {
      body: this.getNodeParameter('replyBody', i) as string,
      internal: this.getNodeParameter('replyInternal', i, false) as boolean,
    };

    const quoted = this.getNodeParameter('replyToMessageId', i, '') as string;

    if (quoted) {
      payload.reply_to_message_id = quoted;
    }

    return subscribyApiRequest.call(this, 'POST', `/support/conversations/${conversationId}/messages`, payload);
  }

  if (operation === 'resolve' || operation === 'reopen' || operation === 'block' || operation === 'unblock') {
    return subscribyApiRequest.call(this, 'POST', `/support/conversations/${conversationId}/${operation}`);
  }

  if (operation === 'assign') {
    const assignee = this.getNodeParameter('assignedToUserId', i, '') as string;

    // Sent explicitly rather than compacted away: the API requires the key to be
    // present, so clearing an assignment is a deliberate null.
    return subscribyApiRequest.call(this, 'POST', `/support/conversations/${conversationId}/assign`, {
      assigned_to_user_id: assignee === '' ? null : assignee,
    });
  }

  throw new NodeOperationError(this.getNode(), `Unknown support conversation operation: ${operation}`);
}

async function dispatchMember(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const filters = this.getNodeParameter('memberListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/members`, qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/members`, undefined, qs);
  }

  const memberId = this.getNodeParameter('memberId', i) as string;

  if (operation === 'ban' || operation === 'kick') {
    const reason = this.getNodeParameter('reason', i, '') as string;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/members/${memberId}/${operation}`,
      compactBody({ reason }),
    );
  }

  if (operation === 'unban') {
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/members/${memberId}/unban`,
    );
  }

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/members/${memberId}`);
  }

  if (operation === 'listIdentities') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/members/${memberId}/identities`);
  }

  if (operation === 'unlinkIdentity') {
    const identityId = this.getNodeParameter('identityId', i) as string;
    await subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}/members/${memberId}/identities/${identityId}`);
    return { member_id: memberId, identity_id: identityId, removed: true };
  }

  throw new NodeOperationError(this.getNode(), `Unknown member operation: ${operation}`);
}

async function dispatchSubscriber(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'findByTelegramId') {
    const telegramId = this.getNodeParameter('telegramId', i) as string;
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/members`,
      undefined,
      { telegram_id: telegramId },
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown subscriber operation: ${operation}`);
}

async function dispatchAccessCode(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;
  const planId = this.getNodeParameter('planId', i) as string;

  if (operation === 'bulkGenerate') {
    const quantity = this.getNodeParameter('quantity', i) as number;
    const expiresInDays = this.getNodeParameter('expiresInDays', i, 0) as number;

    const body: IDataObject = { quantity };
    if (expiresInDays > 0) {
      body.expires_in_days = expiresInDays;
    }

    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/plans/${planId}/access-codes/bulk-generate`,
      body,
    );
  }

  if (operation === 'list') {
    const filters = this.getNodeParameter('accessCodeListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(
        this,
        'GET',
        `/projects/${projectId}/plans/${planId}/access-codes`,
        qs,
      );
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/plans/${planId}/access-codes`,
      undefined,
      qs,
    );
  }

  if (operation === 'delete') {
    const accessCodeId = this.getNodeParameter('accessCodeId', i) as string;
    return subscribyApiRequest.call(
      this,
      'DELETE',
      `/projects/${projectId}/plans/${planId}/access-codes/${accessCodeId}`,
    );
  }

  if (operation === 'preview') {
    const quantity = this.getNodeParameter('quantity', i) as number;
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/plans/${planId}/access-codes/preview`,
      undefined,
      { quantity },
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown access code operation: ${operation}`);
}

async function dispatchResource(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'create') {
    const body = compactBody({
      title: this.getNodeParameter('title', i) as string,
      type: this.getNodeParameter('type', i) as string,
      target: this.getNodeParameter('target', i) as string,
    });
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/resources`, body);
  }

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/resources`);
    return { data: rows };
  }

  if (operation === 'get') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/resources/${resourceId}`);
  }

  if (operation === 'unlink') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/resources/${resourceId}/unlink`,
    );
  }

  if (operation === 'delete') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    return subscribyApiRequest.call(
      this,
      'DELETE',
      `/projects/${projectId}/resources/${resourceId}`,
    );
  }

  if (operation === 'update') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    const fields = this.getNodeParameter('resourceUpdateFields', i, {}) as IDataObject;
    return subscribyApiRequest.call(this, 'PATCH', `/projects/${projectId}/resources/${resourceId}`, fields);
  }

  if (operation === 'activate' || operation === 'deactivate') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/resources/${resourceId}/${operation}`,
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown resource operation: ${operation}`);
}

async function dispatchPaymentMethod(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/payment-methods`);
    return { data: rows };
  }

  if (operation === 'get') {
    const methodId = this.getNodeParameter('methodId', i) as string;
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/payment-methods/${methodId}`,
    );
  }

  if (operation === 'activate' || operation === 'deactivate' || operation === 'sync') {
    const methodId = this.getNodeParameter('methodId', i) as string;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/payment-methods/${methodId}/${operation}`,
    );
  }

  if (operation === 'delete') {
    const methodId = this.getNodeParameter('methodId', i) as string;
    return subscribyApiRequest.call(
      this,
      'DELETE',
      `/projects/${projectId}/payment-methods/${methodId}`,
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown payment method operation: ${operation}`);
}

async function dispatchWebhookEndpoint(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/webhook-endpoints');
    return { data: rows };
  }

  if (operation === 'create') {
    const name = this.getNodeParameter('name', i) as string;
    const url = this.getNodeParameter('url', i) as string;
    const eventsInput = this.getNodeParameter('events', i) as string;
    const extras = this.getNodeParameter('webhookEndpointFields', i, {}) as IDataObject;

    const events = eventsInput
      .split(',')
      .map((event) => event.trim())
      .filter((event) => event.length > 0);

    const body: IDataObject = compactBody({
      name,
      url,
      events,
      project_id: extras.project_id,
    });

    if (extras.allowed_ips) {
      body.allowed_ips = String(extras.allowed_ips)
        .split(',')
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);
    }

    if (extras.is_active !== undefined) {
      body.is_active = extras.is_active;
    }

    return subscribyApiRequest.call(this, 'POST', '/webhook-endpoints', body);
  }

  const endpointId = this.getNodeParameter('endpointId', i) as string;

  if (operation === 'delete') {
    return subscribyApiRequest.call(this, 'DELETE', `/webhook-endpoints/${endpointId}`);
  }

  if (operation === 'rotateSecret') {
    return subscribyApiRequest.call(
      this,
      'POST',
      `/webhook-endpoints/${endpointId}/rotate-secret`,
    );
  }

  if (operation === 'test') {
    return subscribyApiRequest.call(this, 'POST', `/webhook-endpoints/${endpointId}/test`);
  }

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/webhook-endpoints/${endpointId}`);
  }

  if (operation === 'pause' || operation === 'resume') {
    return subscribyApiRequest.call(this, 'POST', `/webhook-endpoints/${endpointId}/${operation}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown webhook endpoint operation: ${operation}`);
}

async function dispatchWebhookDelivery(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const filters = this.getNodeParameter('webhookDeliveryFilters', i, {}) as IDataObject;

    const qs: IDataObject = {};
    if (filters.status && filters.status !== 'all') {
      qs.status = filters.status;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/webhook-deliveries', qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);

    return subscribyApiRequest.call(this, 'GET', '/webhook-deliveries', undefined, qs);
  }

  if (operation === 'retryDead') {
    const since = this.getNodeParameter('since', i, '') as string;
    const body: IDataObject = {};
    if (since) {
      body.since = since;
    }

    return subscribyApiRequest.call(this, 'POST', '/webhook-deliveries/retry-dead', body);
  }

  const deliveryId = this.getNodeParameter('deliveryId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/webhook-deliveries/${deliveryId}`);
  }

  if (operation === 'retry') {
    return subscribyApiRequest.call(this, 'POST', `/webhook-deliveries/${deliveryId}/retry`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown webhook delivery operation: ${operation}`);
}

/**
 * Turn the flat coupon fields n8n collects into the body the API expects.
 *
 * `plan_ids` is typed by hand as a comma-separated string because n8n has no
 * plain string-list input; an empty string becomes an empty list, which the
 * API reads as "every plan in the project" exactly as the dashboard does.
 */
function couponBody(fields: IDataObject): IDataObject {
  const body: IDataObject = { ...fields };

  if (typeof body.plan_ids === 'string') {
    body.plan_ids = idList(body.plan_ids);
  }

  return body;
}

async function dispatchCoupon(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const filters = this.getNodeParameter('couponListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.active !== undefined) {
      qs.active = filters.active ? 'true' : 'false';
    }
    if (filters.code) {
      qs.code = filters.code;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/coupons`, qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/coupons`, undefined, qs);
  }

  if (operation === 'create') {
    const extras = this.getNodeParameter('couponFields', i, {}) as IDataObject;
    const body = couponBody({
      code: this.getNodeParameter('code', i) as string,
      name: this.getNodeParameter('name', i) as string,
      discount_type: this.getNodeParameter('discountType', i) as string,
      discount_value: this.getNodeParameter('discountValue', i) as number,
      ...extras,
    });

    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/coupons`, body);
  }

  const couponId = this.getNodeParameter('couponId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/coupons/${couponId}`);
  }

  if (operation === 'update') {
    const fields = this.getNodeParameter('couponUpdateFields', i, {}) as IDataObject;
    return subscribyApiRequest.call(this, 'PATCH', `/projects/${projectId}/coupons/${couponId}`, couponBody(fields));
  }

  if (operation === 'delete') {
    return subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}/coupons/${couponId}`);
  }

  if (operation === 'activate' || operation === 'deactivate') {
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/coupons/${couponId}/${operation}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown coupon operation: ${operation}`);
}

async function dispatchCreatorTask(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const filters = this.getNodeParameter('creatorTaskListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/creator-tasks`, qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/creator-tasks`, undefined, qs);
  }

  if (operation === 'complete') {
    const taskId = this.getNodeParameter('taskId', i) as string;
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/creator-tasks/${taskId}/complete`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown creator task operation: ${operation}`);
}

async function dispatchRecovery(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'readiness') {
    return subscribyApiRequest.call(this, 'GET', '/recovery/readiness');
  }

  if (operation === 'allowances') {
    return subscribyApiRequest.call(this, 'GET', '/recovery/allowances');
  }

  if (operation === 'listIncidents') {
    const filters = this.getNodeParameter('recoveryIncidentFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/recovery/incidents', qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', '/recovery/incidents', undefined, qs);
  }

  if (operation === 'getIncident') {
    const incidentId = this.getNodeParameter('incidentId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/recovery/incidents/${incidentId}`);
  }

  if (operation === 'listOperations') {
    const filters = this.getNodeParameter('recoveryOperationFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.kind) {
      qs.kind = filters.kind;
    }
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/recovery/operations', qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', '/recovery/operations', undefined, qs);
  }

  if (operation === 'getOperation' || operation === 'rollCall') {
    const operationId = this.getNodeParameter('operationId', i) as string;
    const suffix = operation === 'rollCall' ? '/roll-call' : '';
    return subscribyApiRequest.call(this, 'GET', `/recovery/operations/${operationId}${suffix}`);
  }

  if (operation === 'revert') {
    const operationId = this.getNodeParameter('operationId', i) as string;
    const resourceId = this.getNodeParameter('revertResourceId', i, '') as string;
    const body: IDataObject = {};
    if (resourceId) {
      body.resource_id = resourceId;
    }
    return subscribyApiRequest.call(this, 'POST', `/recovery/operations/${operationId}/revert`, body);
  }

  if (operation === 'nudge' || operation === 'notifyMembers') {
    const operationId = this.getNodeParameter('operationId', i) as string;
    const verb = operation === 'nudge' ? 'nudge' : 'notify-members';
    return subscribyApiRequest.call(this, 'POST', `/recovery/operations/${operationId}/${verb}`);
  }

  if (operation === 'getSettings') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/recovery/settings`);
  }

  if (operation === 'updateSettings') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    const fields = this.getNodeParameter('recoverySettingsFields', i, {}) as IDataObject;
    const body: IDataObject = {};
    if (fields.autoFailover !== undefined) {
      body.auto_failover = fields.autoFailover;
    }
    if (fields.acceptsEmailFee !== undefined) {
      body.accepts_email_fee = fields.acceptsEmailFee;
    }
    if (fields.emailDelivery) {
      body.email_delivery = fields.emailDelivery;
    }
    return subscribyApiRequest.call(this, 'PATCH', `/projects/${projectId}/recovery/settings`, body);
  }

  if (operation === 'removeStandbyInstallation') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}/recovery/standby-installation`);
  }

  const resourceOperations: Record<string, [IHttpRequestMethods, string]> = {
    getStandby: ['GET', '/standby'],
    requestStandby: ['POST', '/standby/request'],
    withdrawStandbyRequest: ['DELETE', '/standby/request'],
    useStandby: ['POST', '/standby/use'],
    removeStandby: ['DELETE', '/standby'],
    requestReplacement: ['POST', '/replacement/request'],
    withdrawReplacementRequest: ['DELETE', '/replacement/request'],
  };

  if (resourceOperations[operation]) {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    const projectId = await recoveryProjectIdOfResource.call(this, resourceId);
    const [method, suffix] = resourceOperations[operation];
    return subscribyApiRequest.call(this, method, `/projects/${projectId}/resources/${resourceId}${suffix}`);
  }

  if (operation === 'setStandbyMirror') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    const projectId = await recoveryProjectIdOfResource.call(this, resourceId);
    const mirror = this.getNodeParameter('mirror', i) as boolean;
    return subscribyApiRequest.call(this, 'PATCH', `/projects/${projectId}/resources/${resourceId}/standby`, { mirror });
  }

  throw new NodeOperationError(this.getNode(), `Unknown recovery operation: ${operation}`);
}

/**
 * The project a resource belongs to, so the standby routes can be built from
 * the resource alone: the API keys them under the project, the node asks for
 * the resource only.
 */
async function recoveryProjectIdOfResource(this: IExecuteFunctions, resourceId: string): Promise<string> {
  const projects = await subscribyApiRequestAllItems.call(this, 'GET', '/projects');

  for (const project of projects) {
    const projectId = String((project as IDataObject).id);
    const resources = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/resources`);

    if (resources.some((resource) => String((resource as IDataObject).id) === resourceId)) {
      return projectId;
    }
  }

  throw new NodeOperationError(this.getNode(), `Resource ${resourceId} was not found on any project the token can see.`);
}

async function dispatchCannedReply(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/support/canned-replies`);
    return { data: rows };
  }

  if (operation === 'create') {
    const extras = this.getNodeParameter('cannedReplyFields', i, {}) as IDataObject;
    const body: IDataObject = {
      title: this.getNodeParameter('title', i) as string,
      body: this.getNodeParameter('body', i) as string,
      ...extras,
    };

    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/support/canned-replies`, body);
  }

  const replyId = this.getNodeParameter('cannedReplyId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/support/canned-replies/${replyId}`);
  }

  if (operation === 'update') {
    const fields = this.getNodeParameter('cannedReplyUpdateFields', i, {}) as IDataObject;
    return subscribyApiRequest.call(this, 'PATCH', `/projects/${projectId}/support/canned-replies/${replyId}`, fields);
  }

  if (operation === 'delete') {
    return subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}/support/canned-replies/${replyId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown canned reply operation: ${operation}`);
}

async function dispatchSupportSettings(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/support/settings`);
  }

  if (operation === 'update') {
    const fields = this.getNodeParameter('supportSettingsFields', i, {}) as IDataObject;
    return subscribyApiRequest.call(this, 'PATCH', `/projects/${projectId}/support/settings`, fields);
  }

  throw new NodeOperationError(this.getNode(), `Unknown support settings operation: ${operation}`);
}

async function dispatchToken(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/tokens');
    return { data: rows };
  }

  const tokenId = this.getNodeParameter('tokenId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/tokens/${tokenId}`);
  }

  if (operation === 'revoke') {
    return subscribyApiRequest.call(this, 'DELETE', `/tokens/${tokenId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown token operation: ${operation}`);
}

async function dispatchAccount(this: IExecuteFunctions, operation: string): Promise<IDataObject> {
  if (operation === 'getMe') {
    return subscribyApiRequest.call(this, 'GET', '/me');
  }

  throw new NodeOperationError(this.getNode(), `Unknown account operation: ${operation}`);
}

async function dispatchTeam(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    return subscribyApiRequest.call(this, 'GET', '/teams');
  }

  if (operation === 'getCurrent') {
    return subscribyApiRequest.call(this, 'GET', '/teams/current');
  }

  if (operation === 'get') {
    const teamId = this.getNodeParameter('teamId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/teams/${teamId}`);
  }

  if (operation === 'create') {
    const name = this.getNodeParameter('teamName', i) as string;
    return subscribyApiRequest.call(this, 'POST', '/teams', { name });
  }

  if (operation === 'update') {
    const teamId = this.getNodeParameter('teamId', i) as string;
    const name = this.getNodeParameter('teamName', i) as string;
    return subscribyApiRequest.call(this, 'PATCH', `/teams/${teamId}`, { name });
  }

  if (operation === 'delete') {
    const teamId = this.getNodeParameter('teamId', i) as string;
    await subscribyApiRequest.call(this, 'DELETE', `/teams/${teamId}`);
    return { data: { id: teamId, deleted: true } };
  }

  throw new NodeOperationError(this.getNode(), `Unknown team operation: ${operation}`);
}

async function dispatchTeamMember(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const teamId = this.getNodeParameter('teamId', i) as string;

  if (operation === 'list') {
    return subscribyApiRequest.call(this, 'GET', `/teams/${teamId}/members`);
  }

  if (operation === 'get') {
    const userId = this.getNodeParameter('userId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/teams/${teamId}/members/${userId}`);
  }

  if (operation === 'invite') {
    const email = this.getNodeParameter('memberEmail', i) as string;
    const role = this.getNodeParameter('memberRole', i) as string;
    return subscribyApiRequest.call(this, 'POST', `/teams/${teamId}/members`, { email, role });
  }

  if (operation === 'updateRole') {
    const userId = this.getNodeParameter('userId', i) as string;
    const role = this.getNodeParameter('memberRole', i) as string;
    return subscribyApiRequest.call(this, 'PATCH', `/teams/${teamId}/members/${userId}/role`, { role });
  }

  if (operation === 'remove') {
    const userId = this.getNodeParameter('userId', i) as string;
    await subscribyApiRequest.call(this, 'DELETE', `/teams/${teamId}/members/${userId}`);
    return { data: { team_id: teamId, user_id: userId, removed: true } };
  }

  if (operation === 'cancelInvitation') {
    const invitationId = this.getNodeParameter('invitationId', i) as string;
    await subscribyApiRequest.call(this, 'DELETE', `/teams/${teamId}/invitations/${invitationId}`);
    return { data: { team_id: teamId, invitation_id: invitationId, cancelled: true } };
  }

  throw new NodeOperationError(this.getNode(), `Unknown team member operation: ${operation}`);
}

async function dispatchRole(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/roles');
    return { data: rows };
  }

  if (operation === 'get') {
    const roleId = this.getNodeParameter('roleId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/roles/${roleId}`);
  }

  if (operation === 'create') {
    const body = compactBody({
      team_id: this.getNodeParameter('roleTeamId', i) as string,
      code: this.getNodeParameter('roleCode', i) as string,
      name: this.getNodeParameter('roleName', i) as string,
      description: this.getNodeParameter('roleDescription', i, '') as string,
      permissions: splitCodes(this.getNodeParameter('rolePermissions', i, '') as string),
    });

    return subscribyApiRequest.call(this, 'POST', '/roles', body);
  }

  if (operation === 'update') {
    const roleId = this.getNodeParameter('roleId', i) as string;
    const fields = this.getNodeParameter('roleUpdateFields', i, {}) as IDataObject;

    const body = compactBody({
      name: fields.name,
      description: fields.description,
      /*
       * Only sent when the field was filled in. An omitted key means "leave the
       * set alone" server-side, so passing an empty array would strip every
       * permission from the role instead.
       */
      permissions: typeof fields.permissions === 'string' && fields.permissions !== ''
        ? splitCodes(fields.permissions)
        : undefined,
    });

    return subscribyApiRequest.call(this, 'PATCH', `/roles/${roleId}`, body);
  }

  if (operation === 'delete') {
    const roleId = this.getNodeParameter('roleId', i) as string;
    await subscribyApiRequest.call(this, 'DELETE', `/roles/${roleId}`);
    return { data: { id: roleId, deleted: true } };
  }

  throw new NodeOperationError(this.getNode(), `Unknown role operation: ${operation}`);
}

async function dispatchGroup(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/groups');
    return { data: rows };
  }

  if (operation === 'get') {
    const groupId = this.getNodeParameter('groupId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/groups/${groupId}`);
  }

  if (operation === 'create') {
    const body = compactBody({
      team_id: this.getNodeParameter('groupTeamId', i) as string,
      code: this.getNodeParameter('groupCode', i) as string,
      name: this.getNodeParameter('groupName', i) as string,
      permissions: splitCodes(this.getNodeParameter('groupPermissions', i, '') as string),
    });

    return subscribyApiRequest.call(this, 'POST', '/groups', body);
  }

  if (operation === 'update') {
    const groupId = this.getNodeParameter('groupId', i) as string;
    const fields = this.getNodeParameter('groupUpdateFields', i, {}) as IDataObject;

    const body = compactBody({
      name: fields.name,
      permissions: typeof fields.permissions === 'string' && fields.permissions !== ''
        ? splitCodes(fields.permissions)
        : undefined,
    });

    return subscribyApiRequest.call(this, 'PATCH', `/groups/${groupId}`, body);
  }

  if (operation === 'delete') {
    const groupId = this.getNodeParameter('groupId', i) as string;
    await subscribyApiRequest.call(this, 'DELETE', `/groups/${groupId}`);
    return { data: { id: groupId, deleted: true } };
  }

  if (operation === 'syncMembers') {
    const groupId = this.getNodeParameter('groupId', i) as string;

    /*
     * Sent even when empty, unlike the permission fields above. Clearing a
     * group is a legitimate request and the endpoint distinguishes "no members"
     * from "field omitted".
     */
    const userIds = splitCodes(this.getNodeParameter('groupMemberIds', i, '') as string);

    return subscribyApiRequest.call(this, 'PUT', `/groups/${groupId}/members`, { user_ids: userIds });
  }

  throw new NodeOperationError(this.getNode(), `Unknown group operation: ${operation}`);
}

async function dispatchActivity(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const subjectType = this.getNodeParameter('subjectType', i) as string;
    const subjectId = this.getNodeParameter('subjectId', i) as string;
    const limit = this.getNodeParameter('activityLimit', i, 50) as number;

    const qs: IDataObject = {
      subject_type: subjectType,
      subject_id: subjectId,
    };
    if (limit) {
      qs.limit = limit;
    }

    return subscribyApiRequest.call(this, 'GET', '/activity', undefined, qs);
  }

  throw new NodeOperationError(this.getNode(), `Unknown activity operation: ${operation}`);
}

async function dispatchBroadcast(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'listAudiences') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/broadcasts/audiences`);
  }

  const audience = this.getNodeParameter('broadcastAudience', i, 'all') as string;
  const passWindowId = this.getNodeParameter('broadcastPassWindowId', i, '') as string;
  const planId = this.getNodeParameter('broadcastPlanId', i, '') as string;

  /*
   * Only sent for the one segment that reads it. The field is hidden for every
   * other audience, so its default would otherwise travel on every request and
   * appear in the echoed response as a filter the user never set.
   */
  const expiringWithinDays =
    audience === 'expiring_soon'
      ? (this.getNodeParameter('broadcastExpiringWithinDays', i, 7) as number)
      : null;

  if (operation === 'preview') {
    const query: IDataObject = { audience };

    if (passWindowId) {
      query.pass_window_id = passWindowId;
    }

    if (planId) {
      query.plan_id = planId;
    }

    if (expiringWithinDays !== null) {
      query.expiring_within_days = expiringWithinDays;
    }

    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/broadcasts/preview`, undefined, query);
  }

  if (operation === 'send') {
    /*
     * The send is queued, so the response describes what was addressed rather
     * than what was delivered. Watch the Broadcast Completed trigger for the
     * sent and failed tallies.
     */
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/broadcasts`, {
      message: this.getNodeParameter('broadcastMessage', i) as string,
      audience,
      pass_window_id: passWindowId || null,
      plan_id: planId || null,
      expiring_within_days: expiringWithinDays,
    });
  }

  throw new NodeOperationError(this.getNode(), `Unknown broadcast operation: ${operation}`);
}

async function dispatchBot(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'getStatus') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/bot`);
  }

  if (operation === 'disconnect') {
    return subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}/bot`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown bot operation: ${operation}`);
}

async function dispatchConnector(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const status = this.getNodeParameter('connectorStatus', i, '') as string;
    const qs: IDataObject = status ? { status } : {};

    return subscribyApiRequest.call(this, 'GET', '/connectors', {}, qs);
  }

  if (operation === 'get') {
    const connectorKey = this.getNodeParameter('connectorKey', i) as string;

    return subscribyApiRequest.call(this, 'GET', `/connectors/${encodeURIComponent(connectorKey)}`);
  }

  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'listInstallations') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/connectors`);
  }

  if (operation === 'getInstallation') {
    const connectorKey = this.getNodeParameter('connectorKey', i) as string;

    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/connectors/${encodeURIComponent(connectorKey)}/installation`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown connector operation: ${operation}`);
}

async function dispatchDistribution(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'getBotLink') {
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/distribution/bot-link`,
    );
  }

  if (operation === 'getPortalUrl') {
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/distribution/portal-url`,
    );
  }

  if (operation === 'getDeepLink') {
    const target = this.getNodeParameter('deepLinkTarget', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (target.access_code) {
      qs.access_code = target.access_code;
    }
    if (target.plan_id) {
      qs.plan_id = target.plan_id;
    }
    if (target.custom) {
      qs.custom = target.custom;
    }

    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/distribution/deep-link`,
      undefined,
      qs,
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown distribution operation: ${operation}`);
}

async function dispatchAnalytics(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const filters = this.getNodeParameter('analyticsFilters', i, {}) as IDataObject;
  const qs: IDataObject = {};
  const passthrough: Array<keyof IDataObject> = [
    'project_id',
    'period',
    'from',
    'to',
    'compare_period',
    'cursor',
    'limit',
  ];
  for (const key of passthrough) {
    const value = filters[key];
    if (value !== undefined && value !== '') {
      qs[key as string] = value;
    }
  }

  if (operation === 'getDashboard') {
    return subscribyApiRequest.call(this, 'GET', '/analytics/dashboard', undefined, qs);
  }

  if (operation === 'getEarnings') {
    const granularity = this.getNodeParameter('granularity', i, '') as string;
    if (granularity) {
      qs.granularity = granularity;
    }
    return subscribyApiRequest.call(this, 'GET', '/analytics/earnings', undefined, qs);
  }

  if (operation === 'getSubscribers') {
    return subscribyApiRequest.call(this, 'GET', '/analytics/subscribers', undefined, qs);
  }

  if (operation === 'getTransactionBreakdown') {
    const dimension = this.getNodeParameter('dimension', i) as string;
    qs.dimension = dimension;
    return subscribyApiRequest.call(
      this,
      'GET',
      '/analytics/transactions/breakdown',
      undefined,
      qs,
    );
  }

  if (operation === 'getPlanPerformance') {
    const projectId = this.getNodeParameter('analyticsProjectId', i) as string;
    qs.project_id = projectId;
    return subscribyApiRequest.call(this, 'GET', '/analytics/plan-performance', undefined, qs);
  }

  if (operation === 'listTransactions') {
    const projectId = this.getNodeParameter('analyticsProjectId', i) as string;
    qs.project_id = projectId;
    return subscribyApiRequest.call(this, 'GET', '/analytics/transactions', undefined, qs);
  }

  throw new NodeOperationError(this.getNode(), `Unknown analytics operation: ${operation}`);
}

function extractData(response: IDataObject): IDataObject | IDataObject[] {
  if (response === null || response === undefined) {
    return {};
  }

  const data = (response as { data?: unknown }).data;

  if (Array.isArray(data)) {
    return data as IDataObject[];
  }

  if (data !== undefined && data !== null) {
    return data as IDataObject;
  }

  return response;
}
