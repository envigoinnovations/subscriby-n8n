import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

/**
 * Personal-Access-Token credential for MemberPass. Tokens are minted
 * at /settings/tokens in the MemberPass dashboard. Production tokens
 * start with `mpt_live_`; non-production (staging, local) tokens start
 * with `mpt_test_`. Every token carries (a) fine-grained ability
 * strings and (b) a `scope:team:{id}` tuple, so one token is always
 * scoped to a single team. The credential test hits `/v1/teams/current`
 * — it only requires `team:view`, so it works for every ability
 * combination.
 */
export class MemberPassApi implements ICredentialType {
  name = 'memberPassApi';

  displayName = 'MemberPass API';

  documentationUrl = 'https://docs.memberpass.net/integrations/n8n';

  properties: INodeProperties[] = [
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description:
        'Personal access token minted at app.memberpass.net/settings/tokens. Production tokens start with `mpt_live_`; non-production tokens start with `mpt_test_`. Must at minimum carry the `team:view` ability.',
      placeholder: 'mpt_live_<id>_<secret>',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.memberpass.net/v1',
      description:
        'Override only for self-hosted or staging installations. Keep the default for production MemberPass.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiToken}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/teams/current',
      method: 'GET',
    },
  };
}
