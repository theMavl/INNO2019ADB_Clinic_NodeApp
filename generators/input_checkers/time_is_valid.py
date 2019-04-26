from re import search


def time_is_valid(time):
    if type(time) is not str:
        return f'Wrong input type. Time is of {type(time)}, must be str.'

    if search('\d\d:\d\d', time) is None:
        return f'Time is of wrong format. Entered "{time}", must be "hh:mm"'

    return 'OK'
