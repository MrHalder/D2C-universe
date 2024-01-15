import requests
import re
import pandas as pd
from bs4 import BeautifulSoup


def add_https(url):
    if not url.startswith('https://') and not url.startswith('http://'):
        return 'https://' + url
    else:
        return url


def payment_methods_available(possible_values):
    payment_methods = []
    for value in possible_values:
        if 'gokwik' in value.lower():
            payment_methods.append('GoKwik')
        if 'simpl' in value.lower():
            payment_methods.append('Simpl')
        if 'zecpe' in value.lower():
            payment_methods.append('Zecpe')
        if 'snapmint' in value.lower():
            payment_methods.append('Snapmint')
        if 'magic-rzp' in value.lower():
            payment_methods.append('Razorpay Magic')
    return list(set(payment_methods))


def getting_payment_info(csv_file):
    # List of URLs to inspect
    urls = pd.read_csv(csv_file)
    urls = urls[urls['website'].notnull()]
    urls['website'] = urls['website'].astype('str')
    urls['website'] = urls['website'].apply(add_https)
    urls_to_inspect = urls['website']  # Replace with your actual URLs

    # Initialize an empty DataFrame
    df = pd.DataFrame(columns=['url', 's1', 's2', 'js_set', 'begin_keywords'])

    i = 0
    for url in urls_to_inspect:
        print(i)
        try:
            # Send an HTTP GET request to the URL with a timeout of 10 seconds
            response = requests.get(url, timeout=10)

            if response.status_code == 200:
                # Get the page source
                page_source = response.text

                # Use regular expressions to find all subdomains (without 'cdn')
                subdomains = re.findall(r'(https?://[a-zA-Z0-9.-]+\.[a-z]+)', page_source)
                subdomains_2 = re.findall(r'(https?://[a-zA-Z0-9.-]*cdn[a-zA-Z0-9.-]*\.[a-z]+)', page_source)
                s1 = list(set(subdomains))
                s2 = list(set(subdomains_2))

                # Use BeautifulSoup to parse the HTML content
                soup = BeautifulSoup(page_source, 'html.parser')

                # Find all script tags with the specified pattern
                script_pattern = re.compile(r'<script[^>]*src=[\'"]([^\'"]*\.js)[\'"][^>]*>', re.IGNORECASE)
                js_set = list(set(script_pattern.findall(str(soup))))

                # Use regular expressions to find 'begin' related keywords in HTML comments
                comment_pattern = r'<!--(.*?)-->'
                search_keyword = 'begin'
                exclude_keyword = 'snippet'
                matches = re.finditer(comment_pattern, page_source, re.DOTALL | re.IGNORECASE)
                begin_keywords = [match.group(1) for match in matches if
                                  search_keyword.lower() in match.group(1).lower() and exclude_keyword not in match.group(
                                      1).lower()]

            else:
                # If the response status code is not 200, set all columns (except 'URL') to lists with 'NA'
                s1 = ['NA']
                s2 = ['NA']
                js_set = ['NA']
                begin_keywords = ['NA']

        except Exception as e:
            print(f"Exception occurred for URL {url}: {e}")
            # Set values to handle the exception
            s1 = ['Exception']
            s2 = ['Exception']
            js_set = ['Exception']
            begin_keywords = ['Exception']

        i += 1

        # Create a dictionary with the data for the current URL
        data = {
            'url': [url],
            's1': [s1],
            's2': [s2],
            'js_set': [js_set],
            'begin_keywords': [begin_keywords],
        }

        # Append the data to the DataFrame
        df = pd.concat([df, pd.DataFrame(data)], ignore_index=True)
        combined_values = df['s1'] + df['s2'] + df['js_set'] + df['begin_keywords']
        urls['payment_method_available_possible'] = combined_values.apply(payment_methods_available)

    return urls


# Save the DataFrame to a CSV file
df = getting_payment_info('Rough Work _ Calculations - Sheet21.csv')  # give the csv file name
# to save your csv file
df.to_csv('/Users/mrhalder/Downloads/Competitors.csv')
