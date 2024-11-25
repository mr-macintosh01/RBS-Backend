import json
import sys
from request import *

longs_code = 400
shorts_code = 400
error = True

counter = 0

while longs_code != 200 or shorts_code != 200 or error:
    try:
        counter += 1

        headers_1 = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
            'Content-Type': 'application/json',
        }

        headers_2 = {
            'Host': 'live-api.cryptoquant.com',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
        }

        headers_3 = {
            'Host': 'live-api.cryptoquant.com',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
            'Content-Type': 'application/json',
        }

        body_sign_in = {
            'email': 'varepaken2003@gmail.com',
            'password': 'VaRe20003',
        }

        params_liqs = {
            'window': 'DAY',
            'from': '1577836800000',
            'to': str(int(sys.argv[1])),
            'limit': '70000',
        }

        body_logout = {}

        sign_in_url = 'https://live-api.cryptoquant.com/api/v1/sign-in'
        get_liq_long = 'https://live-api.cryptoquant.com/api/v3/charts/61adc2cf6bc0e955292d72d7/'
        get_liq_short = 'https://live-api.cryptoquant.com/api/v3/charts/61adc2d36bc0e955292d72e8/'
        logout_url = 'https://live-api.cryptoquant.com/api/v1/logout'

        res_1 = request(sign_in_url, data=body_sign_in, headers=headers_1, method='POST')

        headers_2['Authorization'] = 'Bearer ' + json.loads(res_1[0])['accessToken']
        body_logout['refreshToken'] = json.loads(res_1[0])['refreshToken']
        headers_3['Authorization'] = 'Bearer ' + json.loads(res_1[0])['accessToken']

        res_long = request(get_liq_long, params=params_liqs, headers=headers_2)
        res_short = request(get_liq_short, params=params_liqs, headers=headers_2)
        res_logout = request(logout_url, data=body_logout, headers=headers_3, method='POST')

        l_time, longs = json.loads(res_long[0])['result']['data'][-1]
        s_time, shorts = json.loads(res_short[0])['result']['data'][-1]

        print(f'{l_time}, {longs}, {s_time}, {shorts}')

        longs_code = res_long[-2]
        shorts_code = res_short[-2]
        error = False
    except:
        pass