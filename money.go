package main

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

const (
	dateFormat = "2006-01-02"
	isoFormat  = "2006-01-02T15:04:05.000Z"
	// The original catalog and precision come from the Node Intl currency data.
	standardCurrencies = "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XDR XOF XPF XSU YER ZAR ZMW ZWG ZWL"
	zeroDigits         = "ADP AFN ALL BIF BYR CLP COP DJF ESP GNF HUF IDR IQD IRR ISK ITL JPY KMF KPW KRW LAK LBP LUF MGA MGF MMK MRO PKR PYG RWF SLL SOS STD SYP TMM TRL UGX UYI VND VUV XAF XOF XPF YER ZMK ZWD"
)

var (
	amountPattern   = regexp.MustCompile(`^[0-9]+(\.[0-9]+)?$`)
	currencyPattern = regexp.MustCompile(`^[A-Z]{3}$`)
)

type input map[string]any

func today() string                { return time.Now().UTC().Format(dateFormat) }
func timestamp() string            { return time.Now().UTC().Format(isoFormat) }
func stringValue(value any) string { result, _ := value.(string); return result }
func stringLength(text string) int { return len(utf16.Encode([]rune(text))) }

func precision(code string) int {
	switch {
	case strings.Contains(" "+zeroDigits+" ", " "+code+" "):
		return 0
	case strings.Contains(" BHD JOD KWD LYD OMR TND ", " "+code+" "):
		return 3
	case code == "CLF" || code == "UYW":
		return 4
	default:
		return 2
	}
}

func toMinor(value any, code string) (int64, error) {
	text := stringValue(value)
	if number, ok := value.(json.Number); ok {
		f, err := number.Float64()
		if err == nil && !math.IsInf(f, 0) {
			text = strconv.FormatFloat(f, 'f', -1, 64)
		}
	}
	text = strings.Replace(strings.TrimSpace(text), ",", ".", 1)
	if !amountPattern.MatchString(text) {
		return 0, invalid("Введите положительную сумму или 0")
	}
	whole, fraction, _ := strings.Cut(text, ".")
	digits := precision(code)
	if len(fraction) > digits {
		return 0, invalid(fmt.Sprintf("Для %s допустимо знаков после запятой: %d", code, digits))
	}
	fixed := whole + fraction + strings.Repeat("0", digits-len(fraction))
	amount, err := strconv.ParseInt(fixed, 10, 64)
	if err != nil || amount > 1e14 {
		return 0, invalid("Сумма слишком велика")
	}
	return amount, nil
}

func fromMinor(amount int64, code string) float64 {
	return float64(amount) / math.Pow10(precision(code))
}
func number(value float64) *float64 { return &value }

func convert(amount float64, source, target string, rates map[string]float64) *float64 {
	if source == target || amount == 0 {
		return number(amount)
	}
	if rates[source] <= 0 || rates[target] <= 0 {
		return nil
	}
	value := amount / rates[source] * rates[target]
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil
	}
	return number(value)
}

func validDate(value any) (string, error) {
	if value == nil {
		return today(), nil
	}
	date := stringValue(value)
	_, err := time.Parse(dateFormat, date)
	if err != nil || date < "2000-01-01" || date > today() {
		return "", invalid("Укажите корректную дату от 2000 года до сегодня")
	}
	return date, nil
}

func textField(value any, label string, max int, required bool) (string, error) {
	text, ok := value.(string)
	if value != nil && !ok {
		return "", invalid(fmt.Sprintf("Проверьте поле «%s»", label))
	}
	text = strings.TrimSpace(text)
	if (required && text == "") || stringLength(text) > max {
		limit := "до"
		if required {
			limit = "от 1 до"
		}
		return "", invalid(fmt.Sprintf("Поле «%s»: %s %d символов", label, limit, max))
	}
	return text, nil
}
