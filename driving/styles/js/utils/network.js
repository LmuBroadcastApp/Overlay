class NetworkRequest
{
    constructor(url, responseType, callback)
    {
        this.url = url;
        this.callback = callback;
        this.responseType = responseType;
    }

    Get()
    {
        let xhr = new XMLHttpRequest();
        let cb = this.callback;

        xhr.open('GET', this.url, true);
        xhr.responseType = this.responseType;

        xhr.onload = function()
        {
            if (xhr.readyState == 4 && xhr.status == 200)
            {
                if (cb != null)
                {
                    cb(xhr.response);
                }
            }
            else
            {
                console.log(xhr.status);
            }
        };

        xhr.send();
    }
}
